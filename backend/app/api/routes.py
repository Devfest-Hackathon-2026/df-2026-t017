import time
from typing import Optional
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.core.auth import AuthContext, get_auth_context
from app.core.color_harmony import calculate_color_harmony
from app.core.logging import log_structured
from app.core.physics import (
    calculate_target_clo_range,
    find_swap_candidates,
    sanitize_calendar_events,
    solve_physical_combinations,
)
from app.models.schemas import (
    AnalyzeClothingResponse,
    ChatIntentRequest,
    ChatIntentResponse,
    ComfortFeedbackRequest,
    ComfortFeedbackResponse,
    CrossModalSearchRequest,
    CrossModalSearchResult,
    PipelineTrace,
    RawCalendarEvent,
    RecommendRequest,
    RecommendResponse,
    ScoreBreakdown,
    SwapCandidateItem,
    SwapCandidatesRequest,
    WearOutfitRequest,
    WearOutfitResponse,
    WeatherSnapshot,
)
from app.services.chat_service import resolve_chat_intent
from app.services.demo_data import get_demo_presets, get_demo_wardrobe
from app.services.firestore_service import (
    get_user_calibration,
    record_comfort_feedback,
    record_worn_outfit_to_firestore,
)
from app.services.gemini_service import analyze_clothing_image, rerank_and_explain_outfits
from app.services.vector_service import (
    compute_vector_and_dormancy_scores,
    generate_clothing_embedding,
    search_wardrobe_by_text,
)
from app.services.weather_service import enrich_events_with_weather, get_weather_for_location

router = APIRouter(prefix="/api/v1")


@router.get("/health")
async def health_check() -> dict:
    return {"status": "ok", "service": "closet-me-engine"}


@router.get("/demo/context")
async def get_demo_context() -> dict:
    """審査員用1クリック体験モードの初期クローゼットと3つの検証シナリオを返す。各シナリオの予定には時間別気象を付与。"""
    presets = get_demo_presets()
    # 各プリセットのイベントに、そのプリセットの気象に基づく時間別天気を付与
    for p in presets:
        p["events"] = enrich_events_with_weather(p["events"], p["weather"])

    return {
        "wardrobe": [item.model_dump() for item in get_demo_wardrobe()],
        "presets": presets,
    }


class EnrichEventsRequest(RecommendRequest.__base__):  # BaseModel
    events: list[RawCalendarEvent]
    base_weather: WeatherSnapshot


@router.post("/events/weather", response_model=list[RawCalendarEvent])
async def get_events_with_weather(payload: EnrichEventsRequest) -> list[RawCalendarEvent]:
    """予定一覧に、それぞれの時間と場所に応じたピンポイント気象データを付与して返す。"""
    return enrich_events_with_weather(payload.events, payload.base_weather)


@router.get("/weather/lookup", response_model=WeatherSnapshot)
async def lookup_weather(
    location: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
) -> WeatherSnapshot:
    """Google Maps Platform Weather API / Open-Meteo GPS / フォールバックから地域の気象データを取得。"""
    return get_weather_for_location(location=location, lat=lat, lng=lng)


@router.post("/wardrobe/analyze", response_model=AnalyzeClothingResponse)
async def analyze_wardrobe_photo(
    file: UploadFile = File(...),
    auth: AuthContext = Depends(get_auth_context),
) -> AnalyzeClothingResponse:
    """
    衣服写真をアップロードし、
    1. Vertex AI Gemini で構造化タグ（カテゴリ・色・Clo値・フォーマル度）を抽出
    2. Vertex AI Multimodal Embeddings (1408次元) で視覚特徴ベクトルを抽出
    """
    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty image file.")

    embedding, embed_source = generate_clothing_embedding(
        image_bytes=image_bytes,
        contextual_text=file.filename or "clothing",
    )
    analysis = analyze_clothing_image(
        image_bytes=image_bytes,
        mime_type=file.content_type or "image/jpeg",
        filename=file.filename or "upload.jpg",
        embedding_dim=len(embedding),
    )
    log_structured(
        "INFO",
        "Analyzed clothing photo",
        event_type="wardrobe_analyze",
        uid=auth.uid,
        category=analysis.category,
        clo_value=analysis.clo_value,
        embedding_source=embed_source,
    )
    return analysis


@router.post("/wardrobe/search-crossmodal", response_model=list[CrossModalSearchResult])
async def search_wardrobe_crossmodal(
    payload: CrossModalSearchRequest,
    auth: AuthContext = Depends(get_auth_context),
) -> list[CrossModalSearchResult]:
    """
    Vertex AI Multimodal Embeddings (1408次元) によるテキスト対画像クロスモーダル検索。
    入力テキスト（例: '知的なカフェ作業'）と衣服画像の埋め込みベクトル間のコサイン内積を計算し、類似度順に返す。
    """
    results = search_wardrobe_by_text(payload.query, payload.wardrobe)
    log_structured(
        "INFO",
        "Cross-modal semantic search executed",
        event_type="crossmodal_search",
        uid=auth.uid,
        query=payload.query,
        result_count=len(results),
        top_match_pct=results[0].match_percentage if results else 0,
    )
    return results


@router.post("/recommend/swap-candidates", response_model=list[SwapCandidateItem])
async def get_swap_candidates(
    payload: SwapCandidatesRequest,
    auth: AuthContext = Depends(get_auth_context),
) -> list[SwapCandidateItem]:
    """
    コーディネート内の特定アイテム（アウターや靴）を差し替える際、
    残りのアイテムの合計Clo値と目標Clo値から、熱的安全性と制約充足をリアルタイム判定した代替候補を返す。
    """
    candidates = find_swap_candidates(
        target_category=payload.target_category,
        current_item_ids=payload.current_item_ids,
        target_clo_min=payload.target_clo_min,
        target_clo_max=payload.target_clo_max,
        weather=payload.weather,
        profile=payload.profile,
        wardrobe=payload.wardrobe,
    )
    return candidates


@router.post("/chat/intent", response_model=ChatIntentResponse)
async def handle_chat_intent(
    payload: ChatIntentRequest,
    auth: AuthContext = Depends(get_auth_context),
) -> ChatIntentResponse:
    """
    ユーザーのチャット発話から意図（コーデ再提案・テキスト服登録・Swap・天気変更など）を解析。
    Tier 1 ルールで判定可能なものは0トークンで即答し、AIコストを最小化する。
    """
    res = resolve_chat_intent(payload)
    log_structured(
        "INFO",
        "Chat intent resolved",
        event_type="chat_intent",
        uid=auth.uid,
        intent=res.intent,
        source=res.intent_source,
    )
    return res


@router.post("/feedback/comfort", response_model=ComfortFeedbackResponse)
async def submit_comfort_feedback(
    payload: ComfortFeedbackRequest,
    auth: AuthContext = Depends(get_auth_context),
) -> ComfortFeedbackResponse:
    """
    着用後の1タップ体感フィードバック（cold / optimal / warm）を記録し、
    Cloud Firestore（またはローカル永続層）に個人断熱補正値 (personal_clo_offset) を自己学習保存する。
    """
    res = record_comfort_feedback(uid=auth.uid, req=payload)
    log_structured(
        "INFO",
        "Processed comfort feedback",
        uid=auth.uid,
        feedback=payload.feedback,
        updated_offset=res.updated_offset,
        feedback_count=res.feedback_count,
        storage_source=res.storage_source,
    )
    return res


@router.post("/wardrobe/wear", response_model=WearOutfitResponse)
async def record_outfit_wear(
    payload: WearOutfitRequest,
    auth: AuthContext = Depends(get_auth_context),
) -> WearOutfitResponse:
    """ユーザーが「今日これを着る」を確定した際、Firestoreの着用履歴に記録する。"""
    source = record_worn_outfit_to_firestore(
        uid=auth.uid,
        item_ids=payload.item_ids,
        total_clo=payload.total_clo,
        location=payload.weather_location,
    )
    return WearOutfitResponse(
        status="ok",
        wear_count_updated=len(payload.item_ids),
        saved_to=source,
    )


@router.post("/recommend", response_model=RecommendResponse)
async def recommend_outfits(
    payload: RecommendRequest,
    auth: AuthContext = Depends(get_auth_context),
) -> RecommendResponse:
    """
    Closet Me 3段階ハイブリッド推薦エンドポイント:
      Stage 1: カレンダー予定のピンポイント気象 & 被服気候学(Clo値×METs)着脱レイヤード制約充足ソルバー
      Stage 2: 色彩調和数理計算 × 死蔵衣類(30日以上未着用)再発見ブースト (完全決定論的3軸スコアリング)
      Stage 3: 多基準リランキング & 理由生成 (ハルシネーションゼロ・0トークンミリ秒即答)
    """
    t0 = time.perf_counter()

    # 1. 予定ごとのピンポイント気象情報（時間・場所）を自動補完
    if any(ev.weather is None for ev in payload.events):
        payload.events = enrich_events_with_weather(payload.events, payload.weather)

    # 2. Firestore（またはローカル永続層）から学習済み個人体感オフセットをロードして反映
    calibrated_offset, feedback_count, storage_src = get_user_calibration(auth.uid)
    if payload.profile.personal_clo_offset == 0.0 and calibrated_offset != 0.0:
        payload.profile.personal_clo_offset = calibrated_offset
        payload.profile.feedback_count = feedback_count

    # 3. カレンダー生データからPIIを除去し活動代謝量(METs)・要求フォーマル度へ変換
    sanitized_activities = sanitize_calendar_events(payload.events)
    required_formality = max(a.required_formality for a in sanitized_activities)

    # 4. Stage 1: 予定時間帯気象直結の目標Clo値算出 & レイヤード着脱物理制約ソルバー
    clo_min, clo_max, avg_mets = calculate_target_clo_range(
        weather=payload.weather,
        activities=sanitized_activities,
        profile=payload.profile,
        events=payload.events,
    )
    physical_candidates, explored_count = solve_physical_combinations(
        wardrobe=payload.wardrobe,
        clo_min=clo_min,
        clo_max=clo_max,
        weather=payload.weather,
        profile=payload.profile,
        events=payload.events,
    )

    if not physical_candidates:
        raise HTTPException(
            status_code=422,
            detail="利用可能なトップス・ボトムス・シューズが揃っていないためコーディネートを構成できません。",
        )

    # 5. Stage 2: 3軸多基準スコアリング (被服熱的適合 40% / TPO・色彩調和 35% / 死蔵衣類発掘 25%)
    recent_set = set(payload.recent_worn_ids)
    scored_candidates: list[dict] = []
    for cand in physical_candidates:
        vec_sim, dormancy_score, revived_ids = compute_vector_and_dormancy_scores(
            items=cand.items,
            preferred_styles=payload.profile.preferred_styles,
            recent_worn_ids=recent_set,
        )
        harmony = calculate_color_harmony(cand.items)
        aesthetic_score = round(0.6 * harmony.color_harmony_score + 0.4 * harmony.formality_harmony_score, 3)

        avg_formality = sum(i.formality for i in cand.items) / len(cand.items)
        formality_diff = abs(avg_formality - required_formality)
        tpo_fit = round(max(0.2, 1.0 - formality_diff * 0.28), 3)

        # 3軸純化スコアリング（擬似乱数ベクトルを排除し、完全説明可能に）
        tpo_and_aesthetic = round(0.55 * tpo_fit + 0.45 * aesthetic_score, 3)
        total_score = round(
            0.40 * cand.physics_clo_fit
            + 0.35 * tpo_and_aesthetic
            + 0.25 * dormancy_score,
            3,
        )
        scored_candidates.append(
            {
                "items": cand.items,
                "total_clo": cand.total_clo,
                "revived_ids": revived_ids,
                "palette_name": harmony.palette_name,
                "color_summary": harmony.color_summary,
                "breakdown": ScoreBreakdown(
                    physics_clo_fit=cand.physics_clo_fit,
                    vector_style_similarity=vec_sim,
                    dormancy_revival_score=dormancy_score,
                    tpo_formality_fit=tpo_fit,
                    color_harmony_score=aesthetic_score,
                    total_score=total_score,
                ),
            }
        )

    scored_candidates.sort(key=lambda x: x["breakdown"].total_score, reverse=True)

    # 6. Stage 3: リランキング & 理由生成 (動的タイトル・納得の理由)
    proposals, engine_name = rerank_and_explain_outfits(
        scored_candidates=scored_candidates,
        weather=payload.weather,
        activities=sanitized_activities,
        target_clo_min=clo_min,
        target_clo_max=clo_max,
        destination_location=payload.destination_location,
    )

    latency_ms = round((time.perf_counter() - t0) * 1000, 1)
    trace = PipelineTrace(
        total_wardrobe_items=len(payload.wardrobe),
        total_combinations_explored=explored_count,
        stage1_physics_passed=len(physical_candidates),
        target_clo_min=clo_min,
        target_clo_max=clo_max,
        personal_clo_offset=payload.profile.personal_clo_offset,
        average_mets=avg_mets,
        required_formality=required_formality,
        sanitized_activities=sanitized_activities,
        inference_engine=engine_name,
        latency_ms=latency_ms,
    )

    # Cloud Logging へ構造化推論トレースを記録（Observability担保）
    log_structured(
        "INFO",
        "Outfit recommendation pipeline completed",
        event_type="recommendation_trace",
        uid=auth.uid,
        is_demo=auth.is_demo,
        explored=explored_count,
        stage1_passed=len(physical_candidates),
        target_clo=[clo_min, clo_max],
        offset=payload.profile.personal_clo_offset,
        engine=engine_name,
        latency_ms=latency_ms,
    )

    return RecommendResponse(outfits=proposals, trace=trace)

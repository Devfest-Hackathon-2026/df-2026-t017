import time
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.core.auth import AuthContext, get_auth_context
from app.core.logging import log_structured
from app.core.physics import (
    calculate_target_clo_range,
    sanitize_calendar_events,
    solve_physical_combinations,
)
from app.models.schemas import (
    AnalyzeClothingResponse,
    PipelineTrace,
    RecommendRequest,
    RecommendResponse,
    ScoreBreakdown,
    WeatherSnapshot,
)
from app.services.demo_data import get_demo_presets, get_demo_wardrobe
from app.services.gemini_service import analyze_clothing_image, rerank_and_explain_outfits
from app.services.vector_service import (
    compute_vector_and_dormancy_scores,
    generate_clothing_embedding,
)
from app.services.weather_service import get_weather_for_location

router = APIRouter(prefix="/api/v1")


@router.get("/health")
async def health_check() -> dict:
    return {"status": "ok", "service": "closet-me-engine"}


@router.get("/demo/context")
async def get_demo_context() -> dict:
    """審査員用1クリック体験モードの初期クローゼットと3つの検証シナリオを返す。"""
    return {
        "wardrobe": [item.model_dump() for item in get_demo_wardrobe()],
        "presets": get_demo_presets(),
    }


@router.get("/weather/lookup", response_model=WeatherSnapshot)
async def lookup_weather(location: str = "東京") -> WeatherSnapshot:
    """Google Maps Platform Weather API / フォールバック気象プロバイダから地域の気象データを取得。"""
    return get_weather_for_location(location)


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


@router.post("/recommend", response_model=RecommendResponse)
async def recommend_outfits(
    payload: RecommendRequest,
    auth: AuthContext = Depends(get_auth_context),
) -> RecommendResponse:
    """
    Closet Me 3段階ハイブリッド推薦エンドポイント:
      Stage 1: カレンダー予定のサニタイズ & 被服気候学(Clo値×METs)制約充足ソルバー
      Stage 2: Multimodal Embedding コサイン類似度 × 死蔵衣類(30日以上未着用)再発見ブースト
      Stage 3: Vertex AI Gemini Structured Outputs 多基準リランキング & 理由生成
    """
    t0 = time.perf_counter()

    # 1. カレンダー生データからPIIを除去し活動代謝量(METs)・要求フォーマル度へ変換
    sanitized_activities = sanitize_calendar_events(payload.events)
    required_formality = max(a.required_formality for a in sanitized_activities)

    # 2. Stage 1: 目標Clo値算出 & 物理制約ソルバー
    clo_min, clo_max, avg_mets = calculate_target_clo_range(
        weather=payload.weather,
        activities=sanitized_activities,
        profile=payload.profile,
    )
    physical_candidates, explored_count = solve_physical_combinations(
        wardrobe=payload.wardrobe,
        clo_min=clo_min,
        clo_max=clo_max,
        weather=payload.weather,
        profile=payload.profile,
    )

    if not physical_candidates:
        raise HTTPException(
            status_code=422,
            detail="利用可能なトップス・ボトムス・シューズが揃っていないためコーディネートを構成できません。",
        )

    # 3. Stage 2: ベクトルスタイル類似度 & 死蔵衣類再活用スコアリング
    recent_set = set(payload.recent_worn_ids)
    scored_candidates: list[dict] = []
    for cand in physical_candidates:
        vec_sim, dormancy_score, revived_ids = compute_vector_and_dormancy_scores(
            items=cand.items,
            preferred_styles=payload.profile.preferred_styles,
            recent_worn_ids=recent_set,
        )
        avg_formality = sum(i.formality for i in cand.items) / len(cand.items)
        formality_diff = abs(avg_formality - required_formality)
        tpo_fit = round(max(0.2, 1.0 - formality_diff * 0.28), 3)

        total_score = round(
            0.30 * tpo_fit
            + 0.25 * cand.physics_clo_fit
            + 0.25 * vec_sim
            + 0.20 * dormancy_score,
            3,
        )
        scored_candidates.append(
            {
                "items": cand.items,
                "total_clo": cand.total_clo,
                "revived_ids": revived_ids,
                "breakdown": ScoreBreakdown(
                    physics_clo_fit=cand.physics_clo_fit,
                    vector_style_similarity=vec_sim,
                    dormancy_revival_score=dormancy_score,
                    tpo_formality_fit=tpo_fit,
                    total_score=total_score,
                ),
            }
        )

    scored_candidates.sort(key=lambda x: x["breakdown"].total_score, reverse=True)

    # 4. Stage 3: Vertex AI Gemini リランキング & 推薦理由生成
    proposals, engine_name = rerank_and_explain_outfits(
        scored_candidates=scored_candidates,
        weather=payload.weather,
        activities=sanitized_activities,
        target_clo_min=clo_min,
        target_clo_max=clo_max,
    )

    latency_ms = round((time.perf_counter() - t0) * 1000, 1)
    trace = PipelineTrace(
        total_wardrobe_items=len(payload.wardrobe),
        total_combinations_explored=explored_count,
        stage1_physics_passed=len(physical_candidates),
        target_clo_min=clo_min,
        target_clo_max=clo_max,
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
        engine=engine_name,
        latency_ms=latency_ms,
    )

    return RecommendResponse(outfits=proposals, trace=trace)

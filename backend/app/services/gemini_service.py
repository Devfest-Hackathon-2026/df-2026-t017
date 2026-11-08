import colorsys
import io
import json
from typing import Literal
import numpy as np
from PIL import Image
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.logging import log_structured
from app.models.schemas import (
    AnalyzeClothingResponse,
    ClothingItem,
    OutfitProposal,
    SanitizedActivity,
    ScoreBreakdown,
    WeatherSnapshot,
)


def extract_dominant_colors_from_image(image_bytes: bytes, max_colors: int = 2) -> list[str]:
    """
    画像バイナリの中央部（被写体領域）から、決定論的HSV空間解析により主要色を抽出する。
    AIモデルを使用せず、ミリ秒単位で「ブラック」「ホワイト」「ネイビー」「ベージュ」等を高精度判定。
    """
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        # リサイズして高速化
        img = img.resize((100, 100))
        # 外枠20%を除いた中央領域（60x60）をサンプリング
        crop_box = (20, 20, 80, 80)
        center_img = img.crop(crop_box)
        arr = np.asarray(center_img, dtype=np.float32) / 255.0

        color_votes: dict[str, int] = {}
        total_pixels = arr.shape[0] * arr.shape[1]

        for r, g, b in arr.reshape(-1, 3):
            h, s, v = colorsys.rgb_to_hsv(float(r), float(g), float(b))
            h_deg = h * 360.0

            if v < 0.22:
                label = "ブラック"
            elif v < 0.40 and s < 0.25:
                label = "チャコール"
            elif v > 0.82 and s < 0.16:
                label = "ホワイト"
            elif s < 0.18:
                label = "グレー"
            else:
                if h_deg >= 345 or h_deg < 15:
                    label = "ワインレッド" if v < 0.55 else "レッド"
                elif 15 <= h_deg < 45:
                    if v < 0.45:
                        label = "ブラウン"
                    elif v < 0.70:
                        label = "キャメル"
                    else:
                        label = "ベージュ"
                elif 45 <= h_deg < 75:
                    label = "マスタード" if v < 0.65 else "イエロー"
                elif 75 <= h_deg < 165:
                    if s < 0.40 and v < 0.55:
                        label = "オリーブカーキ"
                    elif v > 0.65:
                        label = "セージグリーン"
                    else:
                        label = "グリーン"
                elif 165 <= h_deg < 210:
                    label = "サックスブルー" if v > 0.65 else "ブルー"
                elif 210 <= h_deg < 265:
                    label = "ネイビー" if v < 0.48 else "ブルー"
                elif 265 <= h_deg < 345:
                    label = "パープル"
                else:
                    label = "ブラック"

            color_votes[label] = color_votes.get(label, 0) + 1

        sorted_colors = sorted(color_votes.items(), key=lambda x: x[1], reverse=True)
        results = [col for col, count in sorted_colors if count >= total_pixels * 0.10][:max_colors]
        return results if results else ["ブラック"]
    except Exception as exc:
        log_structured("WARNING", "Deterministic color extraction fallback", error=str(exc))
        return ["ブラック"]


class _GeminiOutfitItem(BaseModel):
    candidate_index: int = Field(description="渡された候補リストのインデックス")
    title: str = Field(description="魅力的で簡潔なコーディネート名（18文字以内）")
    reason: str = Field(description="予定(TPO)・色彩調和・眠っている服活用の観点からの推薦理由（90文字以内）")
    weather_advice: str = Field(description="時間帯別の寒暖差や雨・風に対するワンポイント助言（60文字以内）")


class _GeminiRerankSchema(BaseModel):
    selections: list[_GeminiOutfitItem]


class _GeminiClothingTagSchema(BaseModel):
    suggested_name: str
    category: str
    subtype: str
    colors: list[str]
    formality: int
    clo_value: float
    water_resistant: bool
    style_tags: list[str]


def _get_vertex_genai_client():
    """
    Google GenAI SDK を Vertex AI (ADC / IAM キーレス認証) モードで初期化する。
    APIキーを一切保持せず Cloud Run のサービスアカウント権限で通信するセキュア構成。
    """
    from google import genai

    return genai.Client(
        vertexai=True,
        project=settings.gcp_project_id,
        location=settings.gcp_location,
    )


def analyze_clothing_image(
    image_bytes: bytes,
    mime_type: str,
    filename: str,
    embedding_dim: int,
) -> AnalyzeClothingResponse:
    """衣服写真を Vertex AI Gemini マルチモーダルで解析し、Clo値・カテゴリ・色を構造化抽出する。"""
    if settings.enable_vertex_ai and settings.gcp_project_id:
        try:
            from google.genai import types

            client = _get_vertex_genai_client()
            prompt = (
                "あなたは被服気候学とファッションに精通したAIスタイリストです。"
                "添付された衣服の画像から以下のJSONスキーマに従いメタデータを抽出してください。\n"
                "- category は top / bottom / outer / shoes のいずれか\n"
                "- formality は 1(部屋着/スポーティ)〜5(ビジネスフォーマル)\n"
                "- clo_value は単体断熱性指標 (Tシャツ:0.09, 長袖シャツ:0.25, ニット:0.36, スラックス:0.24, コート:0.55, 靴:0.04 等)"
            )
            response = client.models.generate_content(
                model=settings.gemini_model_name,
                contents=[
                    types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                    prompt,
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=_GeminiClothingTagSchema,
                    temperature=0.2,
                ),
            )
            parsed = _GeminiClothingTagSchema.model_validate_json(response.text)
            cat = parsed.category if parsed.category in {"top", "bottom", "outer", "shoes"} else "top"
            return AnalyzeClothingResponse(
                suggested_name=parsed.suggested_name,
                category=cat,  # type: ignore[arg-type]
                subtype=parsed.subtype,
                colors=parsed.colors[:3],
                formality=max(1, min(5, parsed.formality)),
                clo_value=round(max(0.03, min(1.2, parsed.clo_value)), 2),
                water_resistant=parsed.water_resistant,
                style_tags=parsed.style_tags[:4],
                embedding_dimensions=embedding_dim,
                analysis_source=f"vertex-ai-{settings.gemini_model_name}",
            )
        except Exception as exc:
            log_structured("WARNING", "Vertex AI image analysis fallback triggered", error=str(exc))

    # ローカル・デモ環境用の非AI・高精度ヒューリスティック解析
    detected_colors = extract_dominant_colors_from_image(image_bytes)
    primary_color = detected_colors[0] if detected_colors else "ブラック"

    lower_name = filename.lower()
    if any(k in lower_name for k in ["coat", "jacket", "outer", "cardigan", "コート", "ジャケット", "ブルゾン", "羽織"]):
        return AnalyzeClothingResponse(
            suggested_name=f"{primary_color}のウールコート",
            category="outer",
            subtype="coat",
            colors=detected_colors,
            formality=4,
            clo_value=0.50,
            water_resistant=False,
            style_tags=["clean", "minimal", "autumn"],
            embedding_dimensions=embedding_dim,
            analysis_source="pillow-cv-deterministic-extractor",
        )
    if any(k in lower_name for k in ["pant", "denim", "skirt", "slacks", "パンツ", "デニム", "ズボン", "スラックス"]):
        return AnalyzeClothingResponse(
            suggested_name=f"{primary_color}のテーパードスラックス",
            category="bottom",
            subtype="slacks",
            colors=detected_colors,
            formality=4,
            clo_value=0.24,
            water_resistant=False,
            style_tags=["clean", "smart-casual"],
            embedding_dimensions=embedding_dim,
            analysis_source="pillow-cv-deterministic-extractor",
        )
    if any(k in lower_name for k in ["shoe", "sneaker", "boot", "loafer", "靴", "スニーカー", "シューズ"]):
        is_water = any(k in lower_name for k in ["water", "rain", "雨", "撥水", "gore"])
        return AnalyzeClothingResponse(
            suggested_name=f"{primary_color}のレザーシューズ",
            category="shoes",
            subtype="loafer",
            colors=detected_colors,
            formality=4,
            clo_value=0.05,
            water_resistant=is_water,
            style_tags=["clean", "rain-ready" if is_water else "minimal"],
            embedding_dimensions=embedding_dim,
            analysis_source="pillow-cv-deterministic-extractor",
        )
    if any(k in lower_name for k in ["shirt", "ワイシャツ", "シャツ", "ブラウス"]):
        return AnalyzeClothingResponse(
            suggested_name=f"{primary_color}のドレスシャツ",
            category="top",
            subtype="shirt",
            colors=detected_colors,
            formality=4,
            clo_value=0.25,
            water_resistant=False,
            style_tags=["clean", "office"],
            embedding_dimensions=embedding_dim,
            analysis_source="pillow-cv-deterministic-extractor",
        )

    # 一般写真（ファイル名にヒントがないスマートフォン実写写真など）
    return AnalyzeClothingResponse(
        suggested_name=f"{primary_color}のクルーネックニット",
        category="top",
        subtype="knit",
        colors=detected_colors,
        formality=3,
        clo_value=0.34,
        water_resistant=False,
        style_tags=["clean", "minimal", "warm"],
        embedding_dimensions=embedding_dim,
        analysis_source="pillow-cv-deterministic-extractor",
    )


def determine_umbrella_advice(
    weather: WeatherSnapshot,
    destination: str | None = None,
) -> tuple[Literal["none", "folding", "umbrella"], str]:
    """降水確率・天候コンディション・移動先の場所から実用的な傘アドバイスを判定する。"""
    prob = weather.rain_probability
    cond = weather.condition_label
    wind = weather.wind_speed_ms
    dest_str = f"（行く場所: {destination}）" if destination else ""

    # 1. 長傘推奨: 降水確率 60%以上、または大雨・横殴りの雨
    if prob >= 0.60 or ("雨" in cond and prob >= 0.50):
        if wind >= 5.0:
            return "umbrella", f"しっかりした雨と強風({wind}m/s)が予想されます{dest_str}。耐風性のある長傘をお持ちください。"
        return "umbrella", f"まとまった雨が予想されます{dest_str}。長傘とお足元（撥水加工の靴等）の対策が安心です。"

    # 2. 折りたたみ傘推奨: 降水確率 30%〜59%、または「一時雨」「夕方から雨」、または移動先がある
    if prob >= 0.30 or any(k in cond for k in ["一時雨", "にわか雨", "夕方", "曇り一時雨"]):
        if prob >= 0.45:
            return "folding", f"急な雨や移動時の備えに{dest_str}、折りたたみ傘をバッグに入れておくと安心です。"
        return "folding", f"降水確率{int(prob * 100)}%です{dest_str}。念のため軽量な折りたたみ傘を持参するのがおすすめです。"

    # 3. 傘不要: 降水確率 30%未満
    return "none", f"一日を通して雨の心配はほぼありません{dest_str}。傘を持たずに身軽にお出かけできます。"


def rerank_and_explain_outfits(
    scored_candidates: list[dict],
    weather: WeatherSnapshot,
    activities: list[SanitizedActivity],
    target_clo_min: float,
    target_clo_max: float,
    destination_location: str | None = None,
) -> tuple[list[OutfitProposal], str]:
    """
    Stage 3:
    物理フィルタ(Stage 1)とベクトル・死蔵スコア(Stage 2)を通過した上位候補を受け取り、
    Vertex AI Gemini の Structured Outputs で多様な3案を選定・自然言語理由を生成する。
    万一の幻覚やAPI障害時も必ず所有アイテムIDのみから決定論的に3案を返す安全設計。
    """
    # アイテム構成が極端に重複しないよう多様性を持たせた上位候補を抽出
    diverse_pool: list[dict] = []
    used_top_bottom_pairs: set[tuple[str, str]] = set()
    for cand in scored_candidates:
        items: list[ClothingItem] = cand["items"]
        top_id = next((i.id for i in items if i.category == "top"), "")
        bot_id = next((i.id for i in items if i.category == "bottom"), "")
        pair = (top_id, bot_id)
        if pair in used_top_bottom_pairs and len(scored_candidates) > 4:
            continue
        used_top_bottom_pairs.add(pair)
        diverse_pool.append(cand)
        if len(diverse_pool) >= 6:
            break

    if not diverse_pool:
        diverse_pool = scored_candidates[:3]

    umb_type, umb_advice = determine_umbrella_advice(weather, destination_location)

    if settings.enable_vertex_ai and settings.gcp_project_id and diverse_pool:
        try:
            from google.genai import types

            client = _get_vertex_genai_client()
            compact_candidates = [
                {
                    "candidate_index": idx,
                    "items": [
                        {
                            "name": i.name,
                            "category": i.category,
                            "colors": i.colors,
                            "formality": i.formality,
                            "days_unworn": i.days_since_last_worn,
                        }
                        for i in c["items"]
                    ],
                    "total_clo": c["total_clo"],
                    "revived_dormant_count": len(c["revived_ids"]),
                    "score": c["breakdown"].total_score,
                }
                for idx, c in enumerate(diverse_pool)
            ]
            prompt_payload = {
                "weather": weather.model_dump(),
                "destination": destination_location,
                "umbrella_advice": umb_advice,
                "target_clo_range": [target_clo_min, target_clo_max],
                "sanitized_schedule": [a.model_dump() for a in activities],
                "candidates": compact_candidates,
            }
            prompt = (
                "あなたはパーソナルAIスタイリスト『Closet Me』です。"
                "被服気候学のClo値フィルタとベクトル類似度計算を通過した以下の候補群から、"
                "今日の予定(TPO)と寒暖差に最も適し、かつ眠っていた服(days_unworn>=30)の新しい着回しを発見できる上位3案を選び、"
                "具体的で納得感のある理由を日本語で作成してください。\n"
                f"{json.dumps(prompt_payload, ensure_ascii=False)}"
            )
            response = client.models.generate_content(
                model=settings.gemini_model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=_GeminiRerankSchema,
                    temperature=0.35,
                ),
            )
            parsed = _GeminiRerankSchema.model_validate_json(response.text)
            proposals: list[OutfitProposal] = []
            seen_indices: set[int] = set()
            for sel in parsed.selections:
                if 0 <= sel.candidate_index < len(diverse_pool) and sel.candidate_index not in seen_indices:
                    seen_indices.add(sel.candidate_index)
                    chosen = diverse_pool[sel.candidate_index]
                    proposals.append(
                        OutfitProposal(
                            rank=len(proposals) + 1,
                            title=sel.title,
                            item_ids=[i.id for i in chosen["items"]],
                            items=chosen["items"],
                            total_clo=chosen["total_clo"],
                            revived_dormant_ids=chosen["revived_ids"],
                            reason=sel.reason,
                            weather_advice=sel.weather_advice,
                            umbrella_type=umb_type,
                            umbrella_advice=umb_advice,
                            score_breakdown=chosen["breakdown"],
                        )
                    )
                if len(proposals) >= 3:
                    break
            if proposals:
                return proposals, f"vertex-ai-{settings.gemini_model_name}"
        except Exception as exc:
            log_structured("WARNING", "Vertex AI Gemini rerank fallback triggered", error=str(exc))

    # 決定論的スタイリスト説明生成器（オフライン・デモ時も予定/Clo値/死蔵服に完全連動）
    proposals = []
    activity_labels = {
        "office": "オフィス・インターン",
        "academic": "大学・ゼミ",
        "dining": "夜の食事会",
        "outdoor": "屋外移動",
        "commute": "移動",
        "casual": "リラックス予定",
    }
    act_names = list(dict.fromkeys(activity_labels.get(a.activity_type, "予定") for a in activities))
    schedule_phrase = "から".join(act_names[:2]) if len(act_names) >= 2 else act_names[0]

    for idx, chosen in enumerate(diverse_pool[:3]):
        items = chosen["items"]
        breakdown: ScoreBreakdown = chosen["breakdown"]
        revived_ids: list[str] = chosen["revived_ids"]
        outer = next((i for i in items if i.category == "outer"), None)
        top = next((i for i in items if i.category == "top"), None)
        palette_name = chosen.get("palette_name") or "調和のスタイリング"
        color_summary = chosen.get("color_summary") or " × ".join(dict.fromkeys(i.colors[0] for i in items if i.colors))

        dormant_item = None
        dormant_note = ""
        if revived_ids:
            dormant_item = next((i for i in items if i.id in revived_ids), None)
            if dormant_item:
                dormant_note = f" {dormant_item.days_since_last_worn}日間眠っていた「{dormant_item.name}」を新鮮に活かせる組み合わせです。"

        # 動的なコーディネートタイトル生成（非AI・色彩パレット×主役アイテム×TPO連動）
        hero_item = outer or top
        hero_short = hero_item.name.split("・")[-1] if hero_item else "スタイル"
        if idx == 0:
            title = f"{palette_name}の{hero_short}"
        elif idx == 1:
            title = f"{schedule_phrase}に映える{palette_name}"
        else:
            if dormant_item:
                title = f"{dormant_item.name.split('・')[-1]}のこなれ着回し"
            else:
                title = f"軽快な{palette_name}"

        reason = (
            f"本日の「{schedule_phrase}」に合うフォーマル度を保ちつつ、"
            f"{palette_name}（{color_summary}）で洗練された印象にまとめました。{dormant_note}"
        )

        temp_gap = round(weather.afternoon_temp_c - weather.evening_temp_c, 1)
        if outer and temp_gap >= 4.0:
            weather_advice = (
                f"昼と夜の寒暖差が{temp_gap}℃あります。日中は「{outer.name}」を脱いで調整し、"
                f"夜({weather.evening_temp_c}℃)の冷え込みに備えられます（合計 {chosen['total_clo']} Clo）。"
            )
        elif weather.rain_probability >= 0.5:
            shoe = next((i for i in items if i.category == "shoes"), None)
            shoe_note = f"足元は雨に強い「{shoe.name}」を選択済み。" if (shoe and shoe.water_resistant) else ""
            weather_advice = f"降水確率{int(weather.rain_probability * 100)}%に対応。{shoe_note}目標断熱レンジ({target_clo_min}〜{target_clo_max} Clo)に適合しています。"
        else:
            weather_advice = (
                f"実効気温と活動量から算出した目標断熱レンジ（{target_clo_min}〜{target_clo_max} Clo）に対し、"
                f"合計 {chosen['total_clo']} Clo で一日中快適に過ごせます。"
            )

        proposals.append(
            OutfitProposal(
                rank=idx + 1,
                title=title,
                item_ids=[i.id for i in items],
                items=items,
                total_clo=chosen["total_clo"],
                revived_dormant_ids=revived_ids,
                reason=reason,
                weather_advice=weather_advice,
                umbrella_type=umb_type,
                umbrella_advice=umb_advice,
                score_breakdown=breakdown,
            )
        )

    return proposals, "hybrid-physics-color-engine (0 tokens)"

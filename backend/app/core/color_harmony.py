"""
被服気候学・ファッション色彩調和 数理エンジン (Deterministic Color & Formality Harmony Engine)

LLM（生成AI）に丸投げせず、決定論的な配色理論・コントラスト比・アイテム間のフォーマル度分散から
コーディネートの審美的・文脈的調和度をミリ秒単位で数理計算する。
"""

from dataclasses import dataclass
from typing import Sequence
from app.models.schemas import ClothingItem


# 色彩分類マップ
COLOR_FAMILIES = {
    "monotone": {"ブラック", "ホワイト", "グレー", "チャコール", "オフホワイト", "black", "white", "gray", "charcoal"},
    "semi_neutral": {"ネイビー", "紺", "ベージュ", "ブラウン", "茶", "キャメル", "カーキ", "オリーブカーキ", "navy", "beige", "brown", "camel", "khaki"},
    "cool_accent": {"ブルー", "青", "サックスブルー", "水色", "グリーン", "緑", "セージグリーン", "ミント"},
    "warm_accent": {"レッド", "赤", "ワインレッド", "ボルドー", "イエロー", "マスタード", "オレンジ", "ピンク"},
}


def categorize_color(color_name: str) -> str:
    """色名を大分類（monotone / semi_neutral / cool_accent / warm_accent / other）にマッピング。"""
    c = color_name.strip().lower()
    for fam, words in COLOR_FAMILIES.items():
        if any(w in c for w in words):
            return fam
    return "other"


@dataclass
class HarmonyAnalysis:
    color_harmony_score: float  # 0.0 ~ 1.0 (色彩調和スコア)
    formality_harmony_score: float  # 0.0 ~ 1.0 (上下・靴のフォーマル度ちぐはぐ度ペナルティ)
    palette_name: str  # 例: "ミニマル・モノトーン", "ネイビー×ニュートラル", "アースカラー調和"
    color_summary: str  # 例: "ブラック × ネイビー × ホワイト"


def calculate_color_harmony(items: Sequence[ClothingItem]) -> HarmonyAnalysis:
    """
    ファッション色彩理論に基づく決定論的配色調和計算:
    1. 無彩色（モノトーン）のみ -> 洗練されたミニマル配色 (0.95)
    2. ベース無彩色/準ニュートラル + 1系統のアクセントカラー -> 王道バランス (0.92)
    3. 準ニュートラル系（ネイビー/ベージュ/ブラウン）の調和 -> 上品なグラデーション (0.90)
    4. 3系統以上の鮮やかな有彩色が混在 -> 散らかりペナルティ (-0.25)
    5. フォーマル度ギャップ（ブレザーLv.4とスウェットLv.1など）のちぐはぐ度を減点
    """
    if not items:
        return HarmonyAnalysis(
            color_harmony_score=0.7,
            formality_harmony_score=0.7,
            palette_name="スタンダード",
            color_summary="ベーシック",
        )

    all_colors: list[str] = []
    for item in items:
        if item.colors:
            all_colors.append(item.colors[0])
        else:
            all_colors.append("ブラック")

    unique_colors = list(dict.fromkeys(all_colors))
    color_summary = " × ".join(unique_colors[:3])

    color_types = [categorize_color(c) for c in all_colors]
    type_counts: dict[str, int] = {}
    for t in color_types:
        type_counts[t] = type_counts.get(t, 0) + 1

    monotone_count = type_counts.get("monotone", 0)
    neutral_count = type_counts.get("semi_neutral", 0)
    cool_count = type_counts.get("cool_accent", 0)
    warm_count = type_counts.get("warm_accent", 0)
    total_accents = cool_count + warm_count

    # 1. 色彩パレット判定と基本スコア
    if total_accents == 0:
        if neutral_count == 0:
            palette_name = "洗練のモノトーン"
            base_score = 0.95
        elif neutral_count <= 2 and "ネイビー" in color_summary:
            palette_name = "ノーブル・ネイビー調和"
            base_score = 0.94
        elif any(c in color_summary for c in ["ベージュ", "ブラウン", "キャメル", "カーキ"]):
            palette_name = "落ち着きのアースカラー"
            base_score = 0.92
        else:
            palette_name = "ベーシック・ニュートラル"
            base_score = 0.90
    elif total_accents == 1 or (cool_count > 0 and warm_count == 0) or (warm_count > 0 and cool_count == 0):
        # 1系統のアクセントカラーを綺麗に効かせた配色
        if cool_count > 0:
            palette_name = "清涼感のあるアクセント配色"
            base_score = 0.91
        else:
            palette_name = "温かみのあるアクセント配色"
            base_score = 0.89
    else:
        # クール系とウォーム系が混ざり合っている
        palette_name = "マルチトーン"
        base_score = 0.72  # 色が散らかりやすいため減点

    # 色数が多すぎる（4着中4着とも全く異なる色）場合の微調整
    if len(unique_colors) >= 4 and total_accents >= 2:
        base_score = max(0.55, base_score - 0.12)

    # 2. フォーマル度ちぐはぐ度計算
    formality_values = [item.formality for item in items]
    max_f = max(formality_values)
    min_f = min(formality_values)
    gap = max_f - min_f

    if gap <= 1:
        # 上下・靴の格調が完璧に一致
        formality_score = 1.0
    elif gap == 2:
        # きれいめ×カジュアルの程よい抜け感（スマートカジュアル許容）
        formality_score = 0.88
    elif gap == 3:
        # スーツジャケットに部屋着パンツのような違和感
        formality_score = 0.50
    else:
        # 極端なちぐはぐ（Lv.5 と Lv.1）
        formality_score = 0.25

    return HarmonyAnalysis(
        color_harmony_score=round(base_score, 3),
        formality_harmony_score=round(formality_score, 3),
        palette_name=palette_name,
        color_summary=color_summary,
    )

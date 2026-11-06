from dataclasses import dataclass
from itertools import product

from app.models.schemas import (
    ClothingCategory,
    ClothingItem,
    RawCalendarEvent,
    SanitizedActivity,
    SwapCandidateItem,
    UserProfile,
    WeatherSnapshot,
)


@dataclass
class CandidateCombo:
    items: list[ClothingItem]
    total_clo: float
    physics_clo_fit: float
    has_outer: bool


def sanitize_calendar_events(events: list[RawCalendarEvent]) -> list[SanitizedActivity]:
    """
    Google Calendar の生イベントから個人名・固有名詞を除去し、
    活動タイプ・推定代謝量(METs)・要求フォーマル度のみへサニタイズ変換する（Zero Raw PII Leakage）。
    """
    if not events:
        return [
            SanitizedActivity(
                time_slot="終日",
                activity_type="casual",
                estimated_mets=1.5,
                required_formality=2,
            )
        ]

    sanitized: list[SanitizedActivity] = []
    for ev in events:
        text = f"{ev.title} {ev.location or ''}".lower()
        slot = f"{ev.start_time}-{ev.end_time}"

        if any(k in text for k in ["インターン", "出社", "mtg", "会議", "面談", "面接", "office", "client"]):
            sanitized.append(
                SanitizedActivity(
                    time_slot=slot,
                    activity_type="office",
                    estimated_mets=1.3,
                    required_formality=4,
                )
            )
        elif any(k in text for k in ["ゼミ", "授業", "講義", "大学", "研究", "campus", "lecture"]):
            sanitized.append(
                SanitizedActivity(
                    time_slot=slot,
                    activity_type="academic",
                    estimated_mets=1.4,
                    required_formality=3,
                )
            )
        elif any(k in text for k in ["食事", "ディナー", "飲み", "ランチ", "カフェ", "ビストロ", "dinner"]):
            sanitized.append(
                SanitizedActivity(
                    time_slot=slot,
                    activity_type="dining",
                    estimated_mets=1.4,
                    required_formality=3,
                )
            )
        elif any(k in text for k in ["散歩", "移動", "買い物", "公園", "屋外", "イベント", "walk", "outdoor"]):
            sanitized.append(
                SanitizedActivity(
                    time_slot=slot,
                    activity_type="outdoor",
                    estimated_mets=2.6,
                    required_formality=2,
                )
            )
        else:
            sanitized.append(
                SanitizedActivity(
                    time_slot=slot,
                    activity_type="casual",
                    estimated_mets=1.6,
                    required_formality=2,
                )
            )
    return sanitized


def calculate_target_clo_range(
    weather: WeatherSnapshot,
    activities: list[SanitizedActivity],
    profile: UserProfile,
) -> tuple[float, float, float]:
    """
    被服気候学（ISO 7730 / ASHRAE 55 簡易熱平衡モデル）に基づき、
    時間帯別気温・風速による対流熱伝達・身体活動代謝量(METs)・個人の寒暖感受性から
    目標 Clo 値レンジ (clo_min, clo_max, avg_mets) を決定論的に算出する。

    基準目安:
      26℃前後 -> 約 0.30 - 0.45 Clo (Tシャツ+薄手パンツ)
      18℃前後 -> 約 0.60 - 0.85 Clo (長袖シャツ/ニット+パンツ+軽羽織)
      10℃前後 -> 約 0.95 - 1.35 Clo (ニット+パンツ+コート/ジャケット)
    """
    # 朝・昼・夜の重み付き基準体感温度（帰りの夜冷えリスクを重視）
    weighted_temp = (
        0.25 * weather.morning_temp_c
        + 0.35 * weather.afternoon_temp_c
        + 0.40 * weather.evening_temp_c
    )
    # 風速による体感温度低下補正（ミスナール簡易近似: 風速1m/sごとに約0.6℃低下相当）
    wind_chill_penalty = max(0.0, (weather.wind_speed_ms - 1.0) * 0.55)
    effective_temp = weighted_temp - wind_chill_penalty

    avg_mets = sum(a.estimated_mets for a in activities) / len(activities)

    # 快適基準温度(24.5℃)からの差分に対する必要断熱量 (1℃低下あたり +0.048 Clo)
    base_clo = 0.36 + (24.5 - effective_temp) * 0.048

    # 活動代謝量(METs)が高いほど産熱が増えるため必要Clo値は下がる
    mets_adjustment = -(avg_mets - 1.3) * 0.14

    # ユーザーの寒がり(+1)/暑がり(-1)補正
    sensitivity_adjustment = profile.cold_sensitivity * 0.12

    center_clo = max(0.22, min(1.65, base_clo + mets_adjustment + sensitivity_adjustment))

    # 朝昼夜の寒暖差に応じた熱的快適許容バンド（PMV ±0.5 相当）
    temp_swing = max(weather.morning_temp_c, weather.afternoon_temp_c, weather.evening_temp_c) - min(
        weather.morning_temp_c, weather.afternoon_temp_c, weather.evening_temp_c
    )
    half_band = 0.11 + min(0.07, temp_swing * 0.008)

    clo_min = round(max(0.18, center_clo - half_band), 2)
    clo_max = round(min(1.85, center_clo + half_band), 2)
    return clo_min, clo_max, round(avg_mets, 2)


def solve_physical_combinations(
    wardrobe: list[ClothingItem],
    clo_min: float,
    clo_max: float,
    weather: WeatherSnapshot,
    profile: UserProfile,
) -> tuple[list[CandidateCombo], int]:
    """
    Stage 1: 決定論的制約充足ソルバー (CSP)
    1. 洗濯中・NGアイテム・雨天時の非撥水シューズ等のハード制約で足切り
    2. Top × Bottom × [Optional Outer] × Shoes の組み合わせ空間を生成
    3. 合計Clo値（基礎空気層 +0.08 Clo 含む）が [clo_min, clo_max] に収まる候補を抽出
    """
    banned = set(profile.banned_item_ids)
    is_rainy = weather.rain_probability >= 0.50

    eligible = [
        item
        for item in wardrobe
        if item.availability == "available" and item.id not in banned
    ]

    tops = [i for i in eligible if i.category == "top"]
    bottoms = [i for i in eligible if i.category == "bottom"]
    outers: list[ClothingItem | None] = [None] + [i for i in eligible if i.category == "outer"]
    shoes_all = [i for i in eligible if i.category == "shoes"]

    # 雨天時（降水確率50%以上）は撥水靴が存在すれば非撥水靴をハード除外
    water_resistant_shoes = [s for s in shoes_all if s.water_resistant]
    shoes_pool = water_resistant_shoes if (is_rainy and water_resistant_shoes) else shoes_all

    if not tops or not bottoms or not shoes_pool:
        return [], 0

    center_clo = (clo_min + clo_max) / 2.0
    half_span = max(0.10, (clo_max - clo_min) / 2.0)

    passed: list[CandidateCombo] = []
    all_scored: list[CandidateCombo] = []
    explored_count = 0

    for top, bottom, outer, shoe in product(tops, bottoms, outers, shoes_pool):
        explored_count += 1
        combo_items = [top, bottom] + ([outer] if outer else []) + [shoe]

        # 衣服間の空気層（境界層）を含む実効Clo値
        raw_clo = sum(i.clo_value for i in combo_items) + 0.06
        total_clo = round(raw_clo, 2)

        distance = abs(total_clo - center_clo)
        physics_fit = round(max(0.0, 1.0 - (distance / (half_span * 1.6))), 3)

        candidate = CandidateCombo(
            items=combo_items,
            total_clo=total_clo,
            physics_clo_fit=physics_fit,
            has_outer=outer is not None,
        )
        all_scored.append(candidate)

        if clo_min <= total_clo <= clo_max:
            passed.append(candidate)

    # 万一クローゼットの服が極端に少なく厳密レンジ内に0件だった場合のみ、最も熱的誤差の小さい上位6件へ安全緩和
    if not passed:
        all_scored.sort(key=lambda c: abs(c.total_clo - center_clo))
        return all_scored[:6], explored_count

    passed.sort(key=lambda c: c.physics_clo_fit, reverse=True)
    return passed, explored_count


def find_swap_candidates(
    target_category: ClothingCategory,
    current_item_ids: list[str],
    target_clo_min: float,
    target_clo_max: float,
    weather: WeatherSnapshot,
    profile: UserProfile,
    wardrobe: list[ClothingItem],
) -> list[SwapCandidateItem]:
    """
    ユーザーがコーディネート内の特定のアイテム（例: 靴やアウター）を差し替えたいとき、
    残りの服の固定Clo値と目標Clo値レンジから、
    1) 熱的安全性（目標Clo値を充足するか）
    2) 雨天撥水制約
    3) 洗濯中・NG除外
    を即時に数理判定（CSP）し、リアルタイム差し替え候補一覧を返す。
    """
    id_to_item = {i.id: i for i in wardrobe}
    current_items = [id_to_item[i_id] for i_id in current_item_ids if i_id in id_to_item]

    # 今回入れ替える対象カテゴリ以外のアイテムのClo値合計
    kept_items = [i for i in current_items if i.category != target_category]
    fixed_clo = sum(i.clo_value for i in kept_items) + 0.06  # 境界層空気層加算

    banned = set(profile.banned_item_ids)
    is_rainy = weather.rain_probability >= 0.50

    pool = [
        item
        for item in wardrobe
        if item.category == target_category and item.availability == "available" and item.id not in banned
    ]

    candidates: list[SwapCandidateItem] = []
    for item in pool:
        new_total_clo = round(fixed_clo + item.clo_value, 2)
        # 物理的安全条件: 目標Clo値内に収まるか
        is_clo_safe = target_clo_min <= new_total_clo <= target_clo_max

        # 雨天時の靴制約
        if is_rainy and target_category == "shoes" and not item.water_resistant:
            is_rain_safe = False
        else:
            is_rain_safe = True

        is_physically_safe = is_clo_safe and is_rain_safe

        # 現在選択されているか
        is_selected = item.id in current_item_ids

        # 簡易TPO予測（フォーマル度）
        avg_formality = sum(i.formality for i in kept_items + [item]) / max(1, len(kept_items) + 1)
        predicted_tpo = round(min(1.0, max(0.4, 1.0 - abs(avg_formality - 3.5) * 0.2)), 2)

        candidates.append(
            SwapCandidateItem(
                item=item,
                is_currently_selected=is_selected,
                is_physically_safe=is_physically_safe,
                new_total_clo=new_total_clo,
                predicted_tpo_fit=predicted_tpo,
                is_revival=item.days_since_last_worn >= 30,
            )
        )

    # 物理安全かつ死蔵ブースト/TPOの高い順にソート
    candidates.sort(
        key=lambda c: (
            1 if c.is_physically_safe else 0,
            1 if c.is_revival else 0,
            c.predicted_tpo_fit,
        ),
        reverse=True,
    )
    return candidates

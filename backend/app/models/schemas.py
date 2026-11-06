from typing import Literal
from pydantic import BaseModel, Field


ClothingCategory = Literal["top", "bottom", "outer", "shoes"]
AvailabilityStatus = Literal["available", "laundry"]


class ClothingItem(BaseModel):
    id: str
    name: str
    category: ClothingCategory
    subtype: str = ""
    colors: list[str] = Field(default_factory=list)
    formality: int = Field(ge=1, le=5, description="1:部屋着/スポーティ 〜 5:ビジネスフォーマル")
    clo_value: float = Field(ge=0.02, le=1.5, description="被服気候学に基づく断熱性指標 (Clo)")
    water_resistant: bool = False
    wear_count: int = Field(default=0, ge=0)
    days_since_last_worn: int = Field(default=14, ge=0, description="最終着用からの経過日数（死蔵度判定）")
    availability: AvailabilityStatus = "available"
    image_url: str | None = None
    style_tags: list[str] = Field(default_factory=list)
    embedding: list[float] | None = Field(default=None, exclude=True)


class WeatherSnapshot(BaseModel):
    location_name: str = "東京・渋谷"
    morning_temp_c: float
    afternoon_temp_c: float
    evening_temp_c: float
    wind_speed_ms: float = Field(default=2.5, ge=0.0)
    rain_probability: float = Field(default=0.1, ge=0.0, le=1.0)
    condition_label: str = "晴れ時々曇り"


class RawCalendarEvent(BaseModel):
    start_time: str
    end_time: str
    title: str
    location: str | None = None


class SanitizedActivity(BaseModel):
    """プライバシー保護のため生タイトルを除去し、服装推論に必要な活動属性のみを保持する構造体。"""
    time_slot: str
    activity_type: Literal["office", "academic", "dining", "outdoor", "commute", "casual"]
    estimated_mets: float = Field(ge=1.0, le=6.0, description="推定身体活動代謝量 (METs)")
    required_formality: int = Field(ge=1, le=5)


class UserProfile(BaseModel):
    cold_sensitivity: int = Field(default=0, ge=-1, le=1, description="-1:暑がり, 0:標準, +1:寒がり")
    preferred_styles: list[str] = Field(default_factory=lambda: ["clean", "minimal"])
    banned_item_ids: list[str] = Field(default_factory=list)


class RecommendRequest(BaseModel):
    weather: WeatherSnapshot
    events: list[RawCalendarEvent]
    profile: UserProfile = Field(default_factory=UserProfile)
    wardrobe: list[ClothingItem]
    recent_worn_ids: list[str] = Field(default_factory=list)


class ScoreBreakdown(BaseModel):
    physics_clo_fit: float
    vector_style_similarity: float
    dormancy_revival_score: float
    tpo_formality_fit: float
    total_score: float


class OutfitProposal(BaseModel):
    rank: int
    title: str
    item_ids: list[str]
    items: list[ClothingItem]
    total_clo: float
    revived_dormant_ids: list[str] = Field(
        default_factory=list,
        description="この提案によって掘り起こされた死蔵衣類（30日以上未着用）のID",
    )
    reason: str
    weather_advice: str
    score_breakdown: ScoreBreakdown


class PipelineTrace(BaseModel):
    """Cloud Logging およびフロントエンドの『Why可視化』に出力する推論トレース。"""
    total_wardrobe_items: int
    total_combinations_explored: int
    stage1_physics_passed: int
    target_clo_min: float
    target_clo_max: float
    average_mets: float
    required_formality: int
    sanitized_activities: list[SanitizedActivity]
    inference_engine: str
    latency_ms: float


class RecommendResponse(BaseModel):
    outfits: list[OutfitProposal]
    trace: PipelineTrace


class AnalyzeClothingResponse(BaseModel):
    suggested_name: str
    category: ClothingCategory
    subtype: str
    colors: list[str]
    formality: int
    clo_value: float
    water_resistant: bool
    style_tags: list[str]
    embedding_dimensions: int
    analysis_source: str


class CrossModalSearchRequest(BaseModel):
    query: str
    wardrobe: list[ClothingItem]


class CrossModalSearchResult(BaseModel):
    item: ClothingItem
    similarity_score: float
    match_percentage: int
    matched_traits: list[str] = Field(default_factory=list)


class SwapCandidatesRequest(BaseModel):
    target_category: ClothingCategory
    current_item_ids: list[str]
    target_clo_min: float
    target_clo_max: float
    weather: WeatherSnapshot
    profile: UserProfile = Field(default_factory=UserProfile)
    wardrobe: list[ClothingItem]


class SwapCandidateItem(BaseModel):
    item: ClothingItem
    is_currently_selected: bool
    is_physically_safe: bool
    new_total_clo: float
    predicted_tpo_fit: float
    is_revival: bool

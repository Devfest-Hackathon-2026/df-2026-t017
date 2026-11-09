from typing import Literal, Optional
from pydantic import BaseModel, Field


ClothingCategory = Literal["top", "bottom", "outer", "shoes", "bag", "accessory"]
AvailabilityStatus = Literal["available", "laundry"]


class ClothingItem(BaseModel):
    id: str
    name: str
    category: ClothingCategory
    subtype: str = ""
    colors: list[str] = Field(default_factory=list)
    formality: int = Field(ge=1, le=5, description="1:部屋着/スポーティ 〜 5:ビジネスフォーマル")
    clo_value: float = Field(ge=0.0, le=1.5, description="被服気候学に基づく断熱性指標 (Clo)")
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


class EventWeather(BaseModel):
    """特定の時間・場所におけるピンポイント気象情報。"""
    temp_c: float = 18.0
    rain_probability: float = 0.0
    condition: str = "晴れ"
    icon_type: str = "sun"


class RawCalendarEvent(BaseModel):
    start_time: str = "12:00"
    end_time: str = "13:00"
    title: str = "予定"
    location: Optional[str] = None
    weather: Optional[EventWeather] = None


class SanitizedActivity(BaseModel):
    """プライバシー保護のため生タイトルを除去し、服装推論に必要な活動属性のみを保持する構造体。"""
    time_slot: str
    activity_type: Literal["office", "academic", "dining", "outdoor", "commute", "casual"]
    estimated_mets: float = Field(ge=1.0, le=6.0, description="推定身体活動代謝量 (METs)")
    required_formality: int = Field(ge=1, le=5)


class UserProfile(BaseModel):
    cold_sensitivity: int = Field(default=0, ge=-1, le=1, description="-1:暑がり, 0:標準, +1:寒がり")
    personal_clo_offset: float = Field(
        default=0.0,
        ge=-0.40,
        le=0.40,
        description="着用後フィードバックから自己学習された個人断熱補正値(Clo)",
    )
    feedback_count: int = Field(default=0, ge=0, description="これまでに蓄積された体感フィードバック回数")
    preferred_styles: list[str] = Field(default_factory=lambda: ["clean", "minimal"])
    personal_color: Literal["spring", "summer", "autumn", "winter", "unknown"] = "unknown"
    banned_item_ids: list[str] = Field(default_factory=list)
    home_location: str | None = Field(default=None, description="デフォルトの居住区（自宅エリア）")


class RecommendRequest(BaseModel):
    profile_id: str = Field(default="default", min_length=1, max_length=80)
    weather: WeatherSnapshot
    events: list[RawCalendarEvent]
    profile: UserProfile = Field(default_factory=UserProfile)
    wardrobe: list[ClothingItem]
    recent_worn_ids: list[str] = Field(default_factory=list)
    destination_location: str | None = Field(default=None, description="行く場所（予定の目的地）")


class ScoreBreakdown(BaseModel):
    physics_clo_fit: float = Field(description="被服気候学・着脱レイヤード熱的適合スコア (0.0-1.0)")
    tpo_formality_fit: float = Field(description="予定TPO要求フォーマル度合致スコア (0.0-1.0)")
    color_harmony_score: float = Field(default=0.90, description="被服色彩調和・フォーマル度分散スコア (0.0-1.0)")
    dormancy_revival_score: float = Field(description="死蔵衣類（30日以上未着用）再発見ブーストスコア (0.0-1.0)")
    vector_style_similarity: float = Field(default=0.85, description="スタイル傾向合致度 (0.0-1.0)")
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
    umbrella_type: Literal["none", "folding", "umbrella"] = Field(
        default="none",
        description="傘の推奨タイプ (none: 不要, folding: 折りたたみ傘, umbrella: 長傘)",
    )
    umbrella_advice: str = Field(default="傘は不要です", description="傘と足元の具体的なアドバイス")
    score_breakdown: ScoreBreakdown


class PipelineTrace(BaseModel):
    """Cloud Logging およびフロントエンドの『Why可視化』に出力する推論トレース。"""
    total_wardrobe_items: int
    total_combinations_explored: int
    stage1_physics_passed: int
    target_clo_min: float
    target_clo_max: float
    personal_clo_offset: float = Field(default=0.0, description="適用された個人体感オフセット(Clo)")
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


# --- チャット Intent & 会話連携用スキーマ ---

ChatIntentType = Literal[
    "recommend",              # コーデ再提案・スタイル変更
    "add_clothing_text",      # チャットテキストからの服登録
    "swap_item",              # アイテム部分入れ替え
    "search_wardrobe",        # 1408次元テイスト検索
    "update_weather",         # 都市・天気変更
    "get_current_location",   # GPS現在地取得
    "set_home_location",      # デフォルト居住区設定
    "reset_to_home",          # 居住区の天気に戻す
    "update_sensitivity",     # 寒がり/暑がり変更
    "add_event",              # 予定追加
    "show_schedule",          # 予定一覧・カレンダー確認
    "open_closet",            # クローゼット確認
    "general_reply",          # 一般対話・スタイリスト返答
]


class ChatContextSummary(BaseModel):
    """トークン削減のため、会話履歴ではなく最小限の状態要約のみを送信する"""
    location_name: str = "東京・渋谷"
    cold_sensitivity: int = 0
    events_count: int = 0
    has_active_outfit: bool = False
    preferred_styles: list[str] = Field(default_factory=list)


class ChatIntentRequest(BaseModel):
    message: str
    context: ChatContextSummary = Field(default_factory=ChatContextSummary)


class ChatIntentResponse(BaseModel):
    intent: ChatIntentType
    assistant_message: str
    clothing_draft: AnalyzeClothingResponse | None = None
    target_category: ClothingCategory | None = None
    location_query: str | None = None
    cold_sensitivity: int | None = None
    preferred_styles: list[str] | None = None
    search_query: str | None = None
    new_event: RawCalendarEvent | None = None
    suggested_chips: list[str] = Field(default_factory=list)
    intent_source: str = "tier1-deterministic-rule"


# --- 体感フィードバック & Firestore 永続化用スキーマ ---

class ComfortFeedbackRequest(BaseModel):
    feedback: Literal["cold", "optimal", "warm"]  # cold(+0.08 Clo) / optimal(0) / warm(-0.08 Clo)
    profile_id: str = Field(default="default", min_length=1, max_length=80)
    worn_item_ids: list[str] = Field(default_factory=list)
    actual_total_clo: float = Field(default=0.9)
    weather_temp_c: float | None = None


class ComfortFeedbackResponse(BaseModel):
    updated_offset: float
    feedback_count: int
    message: str
    storage_source: str  # "cloud-firestore" or "local-cache"


class WearOutfitRequest(BaseModel):
    outfit_rank: int = 1
    profile_id: str = Field(default="default", min_length=1, max_length=80)
    item_ids: list[str]
    total_clo: float
    weather_location: str = "東京・渋谷"


class WearOutfitResponse(BaseModel):
    status: str = "ok"
    wear_count_updated: int
    saved_to: str

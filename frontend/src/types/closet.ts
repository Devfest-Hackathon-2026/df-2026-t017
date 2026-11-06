export type ClothingCategory = "top" | "bottom" | "outer" | "shoes";
export type AvailabilityStatus = "available" | "laundry";

export interface ClothingItem {
  id: string;
  name: string;
  category: ClothingCategory;
  subtype: string;
  colors: string[];
  formality: number;
  clo_value: number;
  water_resistant: boolean;
  wear_count: number;
  days_since_last_worn: number;
  availability: AvailabilityStatus;
  image_url?: string | null;
  style_tags: string[];
}

export interface WeatherSnapshot {
  location_name: string;
  morning_temp_c: number;
  afternoon_temp_c: number;
  evening_temp_c: number;
  wind_speed_ms: number;
  rain_probability: number;
  condition_label: string;
}

export interface RawCalendarEvent {
  start_time: string;
  end_time: string;
  title: string;
  location?: string | null;
}

export interface SanitizedActivity {
  time_slot: string;
  activity_type: "office" | "academic" | "dining" | "outdoor" | "commute" | "casual";
  estimated_mets: number;
  required_formality: number;
}

export interface UserProfile {
  cold_sensitivity: number;
  preferred_styles: string[];
  banned_item_ids: string[];
}

export interface ScoreBreakdown {
  physics_clo_fit: number;
  vector_style_similarity: number;
  dormancy_revival_score: number;
  tpo_formality_fit: number;
  total_score: number;
}

export interface OutfitProposal {
  rank: number;
  title: string;
  item_ids: string[];
  items: ClothingItem[];
  total_clo: number;
  revived_dormant_ids: string[];
  reason: string;
  weather_advice: string;
  score_breakdown: ScoreBreakdown;
}

export interface PipelineTrace {
  total_wardrobe_items: number;
  total_combinations_explored: number;
  stage1_physics_passed: number;
  target_clo_min: number;
  target_clo_max: number;
  average_mets: number;
  required_formality: number;
  sanitized_activities: SanitizedActivity[];
  inference_engine: string;
  latency_ms: number;
}

export interface RecommendResponse {
  outfits: OutfitProposal[];
  trace: PipelineTrace;
}

export interface DemoPreset {
  id: string;
  label: string;
  weather: WeatherSnapshot;
  events: RawCalendarEvent[];
  profile: UserProfile;
}

export interface AnalyzeClothingResponse {
  suggested_name: string;
  category: ClothingCategory;
  subtype: string;
  colors: string[];
  formality: number;
  clo_value: number;
  water_resistant: boolean;
  style_tags: string[];
  embedding_dimensions: number;
  analysis_source: string;
}

export interface CrossModalSearchResult {
  item: ClothingItem;
  similarity_score: number;
  match_percentage: number;
  matched_traits: string[];
}

export interface SwapCandidateItem {
  item: ClothingItem;
  is_currently_selected: boolean;
  is_physically_safe: boolean;
  new_total_clo: number;
  predicted_tpo_fit: number;
  is_revival: boolean;
}

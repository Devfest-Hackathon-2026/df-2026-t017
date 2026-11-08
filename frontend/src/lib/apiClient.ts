import {
  AnalyzeClothingResponse,
  ChatIntentRequest,
  ChatIntentResponse,
  ClothingCategory,
  ClothingItem,
  ComfortFeedbackRequest,
  ComfortFeedbackResponse,
  CrossModalSearchResult,
  DemoPreset,
  RawCalendarEvent,
  RecommendResponse,
  SwapCandidateItem,
  UserProfile,
  WeatherSnapshot,
} from "@/types/closet";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080/api/v1";

export async function fetchDemoContext(): Promise<{
  wardrobe: ClothingItem[];
  presets: DemoPreset[];
}> {
  const res = await fetch(`${API_BASE}/demo/context`, {
    headers: { "X-Demo-Mode": "true" },
  });
  if (!res.ok) {
    throw new Error(`Failed to load demo context: ${res.status}`);
  }
  return res.json();
}

export async function requestRecommendations(params: {
  weather: WeatherSnapshot;
  events: RawCalendarEvent[];
  profile: UserProfile;
  wardrobe: ClothingItem[];
  recent_worn_ids: string[];
  destination_location?: string | null;
}): Promise<RecommendResponse> {
  const res = await fetch(`${API_BASE}/recommend`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Demo-Mode": "true",
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Recommendation failed: ${detail}`);
  }
  return res.json();
}

export async function analyzeClothingPhoto(
  file: File
): Promise<AnalyzeClothingResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/wardrobe/analyze`, {
    method: "POST",
    headers: { "X-Demo-Mode": "true" },
    body: formData,
  });
  if (!res.ok) {
    throw new Error(`Photo analysis failed: ${res.status}`);
  }
  return res.json();
}

export async function lookupWeather(
  params: string | { location?: string; lat?: number; lng?: number }
): Promise<WeatherSnapshot> {
  const queryParams = new URLSearchParams();
  if (typeof params === "string") {
    queryParams.set("location", params);
  } else {
    if (params.location) queryParams.set("location", params.location);
    if (params.lat !== undefined) queryParams.set("lat", String(params.lat));
    if (params.lng !== undefined) queryParams.set("lng", String(params.lng));
  }

  const res = await fetch(`${API_BASE}/weather/lookup?${queryParams.toString()}`, {
    headers: { "X-Demo-Mode": "true" },
  });
  if (!res.ok) {
    throw new Error(`Weather lookup failed: ${res.status}`);
  }
  return res.json();
}

export async function searchWardrobeCrossModal(params: {
  query: string;
  wardrobe: ClothingItem[];
}): Promise<CrossModalSearchResult[]> {
  const res = await fetch(`${API_BASE}/wardrobe/search-crossmodal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Demo-Mode": "true",
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error(`Crossmodal search failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchSwapCandidates(params: {
  target_category: ClothingCategory;
  current_item_ids: string[];
  target_clo_min: number;
  target_clo_max: number;
  weather: WeatherSnapshot;
  profile: UserProfile;
  wardrobe: ClothingItem[];
}): Promise<SwapCandidateItem[]> {
  const res = await fetch(`${API_BASE}/recommend/swap-candidates`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Demo-Mode": "true",
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch swap candidates: ${res.status}`);
  }
  return res.json();
}

export async function interpretChatMessage(
  params: ChatIntentRequest
): Promise<ChatIntentResponse> {
  const res = await fetch(`${API_BASE}/chat/intent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Demo-Mode": "true",
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error(`Chat intent failed: ${res.status}`);
  }
  return res.json();
}

export async function enrichEventsWeather(params: {
  events: RawCalendarEvent[];
  base_weather: WeatherSnapshot;
}): Promise<RawCalendarEvent[]> {
  const res = await fetch(`${API_BASE}/events/weather`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Demo-Mode": "true",
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error(`Failed to enrich events with weather: ${res.status}`);
  }
  return res.json();
}

export async function submitComfortFeedback(
  params: ComfortFeedbackRequest
): Promise<ComfortFeedbackResponse> {
  const res = await fetch(`${API_BASE}/feedback/comfort`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Demo-Mode": "true",
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error(`Failed to submit comfort feedback: ${res.status}`);
  }
  return res.json();
}

export async function recordOutfitWear(params: {
  item_ids: string[];
  total_clo: number;
  weather_location?: string;
}): Promise<{ status: string; wear_count_updated: number; saved_to: string }> {
  const res = await fetch(`${API_BASE}/wardrobe/wear`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Demo-Mode": "true",
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error(`Failed to record worn outfit: ${res.status}`);
  }
  return res.json();
}

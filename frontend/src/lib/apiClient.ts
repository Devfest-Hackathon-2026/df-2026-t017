import {
  AnalyzeClothingResponse,
  ClothingItem,
  DemoPreset,
  RawCalendarEvent,
  RecommendResponse,
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

import { ClosetProfile } from "@/types/closet";

const PROFILES_KEY = "closetme_profiles_v1";
const ACTIVE_PROFILE_KEY = "closetme_active_profile_v1";

export const DEFAULT_PROFILE: ClosetProfile = {
  id: "default",
  name: "マイプロフィール",
  gender: "unspecified",
  personal_color: "unknown",
  age_group: "unspecified",
  cold_sensitivity: 0,
  personal_clo_offset: 0,
  feedback_count: 0,
  preferred_styles: ["clean", "minimal"],
  banned_item_ids: [],
};

export function loadProfiles(): ClosetProfile[] {
  if (typeof window === "undefined") return [DEFAULT_PROFILE];
  try {
    const parsed = JSON.parse(localStorage.getItem(PROFILES_KEY) || "[]");
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [DEFAULT_PROFILE];
  } catch {
    return [DEFAULT_PROFILE];
  }
}

export function saveProfiles(profiles: ClosetProfile[]): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  }
}

export function loadActiveProfileId(): string {
  if (typeof window === "undefined") return DEFAULT_PROFILE.id;
  return localStorage.getItem(ACTIVE_PROFILE_KEY) || DEFAULT_PROFILE.id;
}

export function saveActiveProfileId(profileId: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(ACTIVE_PROFILE_KEY, profileId);
  }
}

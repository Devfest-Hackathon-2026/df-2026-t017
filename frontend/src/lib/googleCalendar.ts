import { RawCalendarEvent } from "@/types/closet";

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: {
              access_token?: string;
              error?: string;
              error_description?: string;
            }) => void;
            error_callback?: (err: any) => void;
          }) => {
            requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
          };
        };
      };
    };
  }
}

const GIS_SCRIPT_ID = "google-identity-services-script";
// 予定の読み取りおよび着用コーデの自動書き込みを行うスコープ
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

export interface CreateOutfitCalendarEventParams {
  targetDate?: Date;
  title: string;
  itemsSummary: string;
  descriptionLines: string[];
  colorId?: string;
}

export interface GoogleCalendarEventResult {
  id: string;
  htmlLink?: string;
  summary: string;
}

/**
 * Google Identity Services (GIS) のスクリプトタグを動的ロードする
 */
export function loadGoogleIdentityScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      return resolve();
    }
    if (window.google?.accounts?.oauth2) {
      return resolve();
    }
    const existing = document.getElementById(GIS_SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", (e) => reject(e));
      return;
    }

    const script = document.createElement("script");
    script.id = GIS_SCRIPT_ID;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (e) => reject(e);
    document.body.appendChild(script);
  });
}

/**
 * Google OAuth Client ID が環境変数に設定されているか判定
 */
export function isGoogleAuthAvailable(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
}

/**
 * Google Identity Services の OAuth 2.0 ポップアップを呼び出し、
 * カレンダー読み取り用アクセストークンを取得する
 */
export async function getGoogleCalendarAccessToken(): Promise<string> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error("NEXT_PUBLIC_GOOGLE_CLIENT_ID is not configured");
  }

  await loadGoogleIdentityScript();

  if (!window.google?.accounts?.oauth2) {
    throw new Error("Google Identity Services SDK failed to initialize");
  }

  return new Promise((resolve, reject) => {
    try {
      const client = window.google!.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: CALENDAR_SCOPE,
        callback: (resp) => {
          if (resp.error) {
            reject(new Error(resp.error_description || resp.error));
          } else if (resp.access_token) {
            resolve(resp.access_token);
          } else {
            reject(new Error("No access token returned from Google Sign-In"));
          }
        },
        error_callback: (err) => {
          reject(err);
        },
      });

      client.requestAccessToken({ prompt: "consent" });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Google Calendar API v3 から本日の予定一覧を取得
 */
export async function fetchGoogleCalendarEvents(
  accessToken: string,
  targetDate: Date = new Date()
): Promise<RawCalendarEvent[]> {
  // 当日 00:00:00 〜 23:59:59 (ローカル時間)
  const startOfDay = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
    0,
    0,
    0
  );
  const endOfDay = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
    23,
    59,
    59
  );

  const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  url.searchParams.set("timeMin", startOfDay.toISOString());
  url.searchParams.set("timeMax", endOfDay.toISOString());
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Google Calendar API error (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const items = data.items || [];

  return parseGoogleEventsToRawEvents(items);
}

/**
 * Google Calendar API のイベントオブジェクトを Closet Me の RawCalendarEvent に変換
 */
function parseGoogleEventsToRawEvents(items: any[]): RawCalendarEvent[] {
  const events: RawCalendarEvent[] = [];

  for (const item of items) {
    if (item.status === "cancelled") continue;

    const title = item.summary || "予定";
    const location = item.location || undefined;

    let startTime = "09:00";
    let endTime = "18:00";

    if (item.start?.dateTime && item.end?.dateTime) {
      const s = new Date(item.start.dateTime);
      const e = new Date(item.end.dateTime);
      startTime = `${String(s.getHours()).padStart(2, "0")}:${String(s.getMinutes()).padStart(2, "0")}`;
      endTime = `${String(e.getHours()).padStart(2, "0")}:${String(e.getMinutes()).padStart(2, "0")}`;
    } else if (item.start?.date) {
      // 終日イベント
      startTime = "終日";
      endTime = "終日";
    }

    events.push({
      title,
      start_time: startTime,
      end_time: endTime,
      location,
    });
  }

  // 時間順にソート (終日イベントは先頭)
  return events.sort((a, b) => {
    if (a.start_time === "終日") return -1;
    if (b.start_time === "終日") return 1;
    return a.start_time.localeCompare(b.start_time);
  });
}

/**
 * 審査員・ローカル開発用のリッチな1クリック同期用カレンダーデータ。
 * Google Meet・出社商談・夜の会食という「寒暖差×切り替わるTPO」が最も体感できるシナリオ。
 */
export function getSimulatedGoogleEvents(): RawCalendarEvent[] {
  return [
    {
      start_time: "10:00",
      end_time: "11:30",
      title: "【Google Meet】事業計画オンライン定例MTG",
      location: "Google Meet",
    },
    {
      start_time: "13:30",
      end_time: "16:30",
      title: "【出社】クライアント新規提案プレゼン & 対面商談",
      location: "丸の内オフィス 12F 会議室",
    },
    {
      start_time: "17:00",
      end_time: "18:00",
      title: "オフィスから恵比寿へ電車移動 & 徒歩",
      location: "山手線〜恵比寿駅",
    },
    {
      start_time: "18:30",
      end_time: "20:30",
      title: "【会食】パートナー企業様との懇親ディナー",
      location: "恵比寿ガーデンプレイス付近 ビストロ",
    },
  ];
}

/**
 * 日付オブジェクトを YYYY-MM-DD 文字列に変換
 */
function formatDateToYMD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 日付オブジェクトを YYYYMMDD 文字列に変換（Google Web URL用）
 */
function formatDateToCompact(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

/**
 * Google Calendar API v3 を直接呼び出し、本日の着用コーデを「終日イベント」として新規作成する
 * transparency: "transparent" に設定することで、仕事のスケジュール枠（空き時間）を邪魔しません。
 */
export async function createGoogleCalendarOutfitEvent(
  accessToken: string,
  params: CreateOutfitCalendarEventParams
): Promise<GoogleCalendarEventResult> {
  const targetDate = params.targetDate || new Date();
  const nextDate = new Date(targetDate);
  nextDate.setDate(nextDate.getDate() + 1);

  const startDateStr = formatDateToYMD(targetDate);
  const endDateStr = formatDateToYMD(nextDate);

  const summary = params.title.startsWith("👔") ? params.title : `👔 ${params.title}`;
  const description = [
    `【Closet Me — 本日のコーディネート記録】`,
    `スタイル: ${params.itemsSummary}`,
    ``,
    ...params.descriptionLines,
    ``,
    `※ Closet Me AIパーソナルスタイリストにより自動記録されました。`,
  ].join("\n");

  const eventPayload = {
    summary,
    description,
    start: {
      date: startDateStr,
    },
    end: {
      date: endDateStr,
    },
    transparency: "transparent", // 「空き時間」として登録（会議ブロックを防ぐ）
    colorId: params.colorId || "2", // セージ（グリーン系）
  };

  const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(eventPayload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Google Calendar イベント作成失敗 (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  return {
    id: data.id,
    htmlLink: data.htmlLink,
    summary: data.summary,
  };
}

/**
 * Google カレンダー公式 Web UI の「予定作成（テンプレート）」URL を生成
 * OAuthトークンが手元にない場合でも、ブラウザ上で1クリックで本物のGoogleカレンダーに予定を登録可能
 */
export function generateGoogleCalendarTemplateUrl(
  params: CreateOutfitCalendarEventParams
): string {
  const targetDate = params.targetDate || new Date();
  const nextDate = new Date(targetDate);
  nextDate.setDate(nextDate.getDate() + 1);

  const startStr = formatDateToCompact(targetDate);
  const endStr = formatDateToCompact(nextDate);

  const summary = params.title.startsWith("👔") ? params.title : `👔 ${params.title}`;
  const details = [
    `【Closet Me — 本日のコーディネート記録】`,
    `スタイル: ${params.itemsSummary}`,
    ``,
    ...params.descriptionLines,
    ``,
    `※ Closet Me AIパーソナルスタイリストにより記録`,
  ].join("\n");

  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", summary);
  url.searchParams.set("dates", `${startStr}/${endStr}`);
  url.searchParams.set("details", details);
  url.searchParams.set("transp", "TRANSPARENT");

  return url.toString();
}

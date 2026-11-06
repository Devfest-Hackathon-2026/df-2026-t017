"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  CalendarPlus,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  CloudRain,
  Cpu,
  Filter,
  Flame,
  Layers,
  MapPin,
  Plus,
  RefreshCw,
  ShieldCheck,
  Shirt,
  Sparkles,
  Sun,
  Thermometer,
  Trash2,
  Upload,
  Wind,
  X,
} from "lucide-react";
import {
  analyzeClothingPhoto,
  fetchDemoContext,
  lookupWeather,
  requestRecommendations,
} from "@/lib/apiClient";
import {
  AnalyzeClothingResponse,
  ClothingCategory,
  ClothingItem,
  DemoPreset,
  OutfitProposal,
  PipelineTrace,
  RawCalendarEvent,
  UserProfile,
  WeatherSnapshot,
} from "@/types/closet";

const CATEGORY_LABELS: Record<ClothingCategory, string> = {
  top: "トップス",
  bottom: "ボトムス",
  outer: "アウター",
  shoes: "シューズ",
};

const POPULAR_CITIES = [
  "東京・渋谷",
  "神奈川・横浜",
  "大阪・梅田",
  "京都・烏丸",
  "愛知・名古屋",
  "福岡・天神",
  "北海道・札幌",
  "宮城・仙台",
];

export default function ClosetMeApp() {
  const [activeTab, setActiveTab] = useState<"today" | "closet">("today");
  const [wardrobe, setWardrobe] = useState<ClothingItem[]>([]);
  const [presets, setPresets] = useState<DemoPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");

  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [isChangingCity, setIsChangingCity] = useState<boolean>(false);
  const [customCityInput, setCustomCityInput] = useState<string>("");
  const [weatherLoading, setWeatherLoading] = useState<boolean>(false);

  const [events, setEvents] = useState<RawCalendarEvent[]>([]);
  const [isAddingEvent, setIsAddingEvent] = useState<boolean>(false);
  const [newEvent, setNewEvent] = useState({
    title: "",
    start_time: "14:00",
    end_time: "16:00",
    location: "",
  });

  const [profile, setProfile] = useState<UserProfile>({
    cold_sensitivity: 0,
    preferred_styles: ["clean", "minimal"],
    banned_item_ids: [],
  });
  const [recentWornIds, setRecentWornIds] = useState<string[]>([]);
  const [selectedOutfitRank, setSelectedOutfitRank] = useState<number | null>(null);

  const [outfits, setOutfits] = useState<OutfitProposal[]>([]);
  const [trace, setTrace] = useState<PipelineTrace | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // クローゼット絞り込み
  const [selectedCategory, setSelectedCategory] = useState<"all" | ClothingCategory>("all");
  const [filterDormantOnly, setFilterDormantOnly] = useState<boolean>(false);

  // 服追加フォーム用State
  const [analyzingPhoto, setAnalyzingPhoto] = useState<boolean>(false);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const [analyzedDraft, setAnalyzedDraft] = useState<AnalyzeClothingResponse | null>(null);

  // 衣服詳細モーダル用State
  const [selectedItemDetail, setSelectedItemDetail] = useState<ClothingItem | null>(null);

  const runRecommendation = useCallback(
    async (
      w: WeatherSnapshot,
      ev: RawCalendarEvent[],
      prof: UserProfile,
      items: ClothingItem[],
      recent: string[]
    ) => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const res = await requestRecommendations({
          weather: w,
          events: ev,
          profile: prof,
          wardrobe: items,
          recent_worn_ids: recent,
        });
        setOutfits(res.outfits);
        setTrace(res.trace);
        setSelectedOutfitRank(null);
      } catch (err) {
        setErrorMsg(
          err instanceof Error
            ? err.message
            : "バックエンドエンジンへの接続に失敗しました（Cloud Run または uvicorn を確認してください）。"
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    (async () => {
      try {
        const ctx = await fetchDemoContext();
        setWardrobe(ctx.wardrobe);
        setPresets(ctx.presets);
        if (ctx.presets.length > 0) {
          const first = ctx.presets[0];
          setSelectedPresetId(first.id);
          setWeather(first.weather);
          setEvents(first.events);
          setProfile(first.profile);
          await runRecommendation(
            first.weather,
            first.events,
            first.profile,
            ctx.wardrobe,
            []
          );
        }
      } catch {
        setErrorMsg(
          "FastAPI バックエンドに接続できません。バックエンドが稼働しているか確認してください。"
        );
        setLoading(false);
      }
    })();
  }, [runRecommendation]);

  const handleSelectPreset = async (presetId: string) => {
    const found = presets.find((p) => p.id === presetId);
    if (!found) return;
    setSelectedPresetId(found.id);
    setWeather(found.weather);
    setEvents(found.events);
    setProfile(found.profile);
    await runRecommendation(
      found.weather,
      found.events,
      found.profile,
      wardrobe,
      recentWornIds
    );
  };

  const handleCitySelect = async (cityName: string) => {
    setWeatherLoading(true);
    setIsChangingCity(false);
    try {
      const newWeather = await lookupWeather(cityName);
      setWeather(newWeather);
      if (events) {
        await runRecommendation(newWeather, events, profile, wardrobe, recentWornIds);
      }
    } catch {
      setErrorMsg("地域の気象データ取得に失敗しました。");
    } finally {
      setWeatherLoading(false);
    }
  };

  const handleAddCustomEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.title.trim()) return;

    const added: RawCalendarEvent = {
      title: newEvent.title.trim(),
      start_time: newEvent.start_time,
      end_time: newEvent.end_time,
      location: newEvent.location.trim() || undefined,
    };
    const updatedEvents = [...events, added].sort((a, b) =>
      a.start_time.localeCompare(b.start_time)
    );
    setEvents(updatedEvents);
    setIsAddingEvent(false);
    setNewEvent({ title: "", start_time: "14:00", end_time: "16:00", location: "" });

    if (weather) {
      await runRecommendation(weather, updatedEvents, profile, wardrobe, recentWornIds);
    }
  };

  const handleDeleteEvent = async (index: number) => {
    const updated = events.filter((_, i) => i !== index);
    setEvents(updated);
    if (weather) {
      await runRecommendation(weather, updated, profile, wardrobe, recentWornIds);
    }
  };

  const handleSensitivityChange = async (delta: number) => {
    if (!weather) return;
    const nextProfile: UserProfile = {
      ...profile,
      cold_sensitivity: delta,
    };
    setProfile(nextProfile);
    await runRecommendation(weather, events, nextProfile, wardrobe, recentWornIds);
  };

  const handleWearOutfit = (proposal: OutfitProposal) => {
    setSelectedOutfitRank(proposal.rank);
    const updatedWardrobe = wardrobe.map((item) =>
      proposal.item_ids.includes(item.id)
        ? {
            ...item,
            wear_count: item.wear_count + 1,
            days_since_last_worn: 0,
          }
        : item
    );
    setWardrobe(updatedWardrobe);
    setRecentWornIds(proposal.item_ids);
  };

  const handleToggleLaundry = async (itemId: string) => {
    const updated = wardrobe.map((item) =>
      item.id === itemId
        ? {
            ...item,
            availability:
              item.availability === "available"
                ? ("laundry" as const)
                : ("available" as const),
          }
        : item
    );
    setWardrobe(updated);
    if (weather) {
      await runRecommendation(weather, events, profile, updated, recentWornIds);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 即時ローカルプレビュー作成
    const previewUrl = URL.createObjectURL(file);
    setPreviewPhotoUrl(previewUrl);

    setAnalyzingPhoto(true);
    try {
      const result = await analyzeClothingPhoto(file);
      setAnalyzedDraft(result);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "画像解析に失敗しました。"
      );
    } finally {
      setAnalyzingPhoto(false);
    }
  };

  const handleConfirmAddClothing = async () => {
    if (!analyzedDraft) return;
    const newItem: ClothingItem = {
      id: `custom_${Date.now()}`,
      name: analyzedDraft.suggested_name,
      category: analyzedDraft.category,
      subtype: analyzedDraft.subtype,
      colors: analyzedDraft.colors,
      formality: analyzedDraft.formality,
      clo_value: analyzedDraft.clo_value,
      water_resistant: analyzedDraft.water_resistant,
      wear_count: 0,
      days_since_last_worn: 45, // 新規・未活用枠として即提案候補に
      availability: "available",
      image_url: previewPhotoUrl,
      style_tags: analyzedDraft.style_tags,
    };
    const updated = [newItem, ...wardrobe];
    setWardrobe(updated);
    setAnalyzedDraft(null);
    setPreviewPhotoUrl(null);
    if (weather) {
      await runRecommendation(weather, events, profile, updated, recentWornIds);
    }
    setActiveTab("today");
  };

  const dormantCount = useMemo(
    () => wardrobe.filter((i) => i.days_since_last_worn >= 30).length,
    [wardrobe]
  );
  const utilizationRate = useMemo(() => {
    if (wardrobe.length === 0) return 0;
    return Math.round(((wardrobe.length - dormantCount) / wardrobe.length) * 100);
  }, [wardrobe, dormantCount]);

  const filteredWardrobe = useMemo(() => {
    return wardrobe.filter((item) => {
      if (selectedCategory !== "all" && item.category !== selectedCategory) {
        return false;
      }
      if (filterDormantOnly && item.days_since_last_worn < 30) {
        return false;
      }
      return true;
    });
  }, [wardrobe, selectedCategory, filterDormantOnly]);

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-zinc-900 pb-20 font-sans selection:bg-zinc-900 selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-white shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight">Closet Me</h1>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
                  DevFest 2026
                </span>
              </div>
              <p className="text-[11px] text-zinc-500">
                被服気候学(Clo値) × Vertex AI パーソナルスタイリスト
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="hidden sm:flex flex-col items-end mr-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>クローゼット稼働率 {utilizationRate}%</span>
              </div>
              <div className="w-24 h-1.5 bg-emerald-100 rounded-full mt-1 overflow-hidden">
                <div
                  className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                  style={{ width: `${utilizationRate}%` }}
                />
              </div>
            </div>

            <div className="flex rounded-xl bg-zinc-100 p-1">
              <button
                onClick={() => setActiveTab("today")}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                  activeTab === "today"
                    ? "bg-white text-zinc-900 shadow-xs"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                本日の提案
              </button>
              <button
                onClick={() => setActiveTab("closet")}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                  activeTab === "closet"
                    ? "bg-white text-zinc-900 shadow-xs"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                手持ち服 ({wardrobe.length})
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-5 space-y-6">
        {/* 1-Click Demo Scenarios */}
        {presets.length > 0 && (
          <section className="rounded-2xl border border-zinc-200/90 bg-white p-3.5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-700">
                <span className="rounded-lg bg-amber-100 px-2 py-0.5 text-amber-900 font-bold">
                  1-Click デモ検証
                </span>
                <span>予定・気象シナリオ切替で推論の変化を即座に比較:</span>
              </div>
              <select
                value={selectedPresetId}
                onChange={(e) => handleSelectPreset(e.target.value)}
                className="rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-800 focus:border-zinc-900 focus:outline-none transition cursor-pointer"
              >
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </section>
        )}

        {errorMsg && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="p-1 hover:bg-red-100 rounded">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {activeTab === "today" ? (
          <>
            {/* Context Grid: Google Maps Weather + Google Calendar */}
            {weather && (
              <div className="grid gap-4 md:grid-cols-2">
                {/* Weather Card (Google Maps Platform Weather API) */}
                <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-xs font-semibold text-zinc-600">
                        {weather.rain_probability >= 0.5 ? (
                          <CloudRain className="h-4 w-4 text-blue-600" />
                        ) : (
                          <Sun className="h-4 w-4 text-amber-500" />
                        )}
                        <span className="tracking-wide">Google Maps Platform Weather</span>
                      </div>
                      <button
                        onClick={() => setIsChangingCity(!isChangingCity)}
                        className="flex items-center gap-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-700 transition"
                      >
                        <MapPin className="h-3 w-3 text-zinc-500" />
                        <span>{weather.location_name}</span>
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>

                    {/* 都市選択ドロップダウン / 検索バー */}
                    {isChangingCity && (
                      <div className="mb-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs space-y-2">
                        <p className="font-semibold text-zinc-700 text-[11px]">
                          天気を取得する都市を選択:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {POPULAR_CITIES.map((city) => (
                            <button
                              key={city}
                              onClick={() => handleCitySelect(city)}
                              className="rounded-lg bg-white border border-zinc-200 px-2 py-1 text-[11px] text-zinc-700 hover:border-zinc-900 transition"
                            >
                              {city}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2 pt-1">
                          <input
                            type="text"
                            placeholder="自由入力（例: 名古屋、金沢など）"
                            value={customCityInput}
                            onChange={(e) => setCustomCityInput(e.target.value)}
                            className="flex-1 rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs focus:outline-none focus:border-zinc-900"
                          />
                          <button
                            onClick={() => {
                              if (customCityInput.trim()) {
                                handleCitySelect(customCityInput.trim());
                                setCustomCityInput("");
                              }
                            }}
                            className="rounded-lg bg-zinc-900 px-3 py-1 text-xs font-bold text-white hover:bg-zinc-800"
                          >
                            変更
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between my-2">
                      <span className="text-sm font-bold text-zinc-900">
                        {weather.condition_label}
                      </span>
                      {weatherLoading && (
                        <span className="flex items-center gap-1 text-[11px] text-zinc-400">
                          <RefreshCw className="h-3 w-3 animate-spin" /> 気象取得中...
                        </span>
                      )}
                    </div>

                    {/* 時間帯別気温グラフィックス */}
                    <div className="grid grid-cols-3 gap-2 text-center my-3">
                      <div className="rounded-xl bg-gradient-to-b from-sky-50 to-zinc-50 p-2.5 border border-sky-100/60">
                        <p className="text-[11px] text-zinc-500 font-medium">朝 (08:00)</p>
                        <p className="text-lg font-bold text-sky-950">{weather.morning_temp_c}℃</p>
                      </div>
                      <div className="rounded-xl bg-gradient-to-b from-amber-50 to-zinc-50 p-2.5 border border-amber-100/60">
                        <p className="text-[11px] text-zinc-500 font-medium">昼 (14:00)</p>
                        <p className="text-lg font-bold text-amber-950">{weather.afternoon_temp_c}℃</p>
                      </div>
                      <div className="rounded-xl bg-gradient-to-b from-indigo-50 to-zinc-50 p-2.5 border border-indigo-100/60">
                        <p className="text-[11px] text-zinc-500 font-medium">夜 (20:00)</p>
                        <p className="text-lg font-bold text-indigo-950">{weather.evening_temp_c}℃</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-zinc-600 pt-3 border-t border-zinc-100">
                    <span className="flex items-center gap-1">
                      <Wind className="h-3.5 w-3.5" /> 風速 {weather.wind_speed_ms} m/s
                    </span>
                    <span className="flex items-center gap-1 font-medium">
                      降水確率 {Math.round(weather.rain_probability * 100)}%
                    </span>
                    <div className="flex items-center gap-1">
                      <Thermometer className="h-3.5 w-3.5 text-zinc-400" />
                      {(
                        [
                          { val: -1, label: "暑がり" },
                          { val: 0, label: "標準" },
                          { val: 1, label: "寒がり" },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.val}
                          onClick={() => handleSensitivityChange(opt.val)}
                          className={`rounded px-1.5 py-0.5 text-[10px] transition ${
                            profile.cold_sensitivity === opt.val
                              ? "bg-zinc-900 text-white font-semibold"
                              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Google Calendar Card (予定のリアルタイム同期・追加・削除) */}
                <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-xs font-semibold text-zinc-600">
                        <Calendar className="h-4 w-4 text-indigo-600" />
                        <span className="tracking-wide">Google Calendar 予定</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                          <ShieldCheck className="h-3 w-3" /> PII サニタイズ済
                        </span>
                        <button
                          onClick={() => setIsAddingEvent(!isAddingEvent)}
                          className="flex items-center gap-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white px-2 py-1 text-[11px] font-medium transition"
                        >
                          <Plus className="h-3 w-3" />
                          <span>予定追加</span>
                        </button>
                      </div>
                    </div>

                    {/* インライン予定追加フォーム */}
                    {isAddingEvent && (
                      <form
                        onSubmit={handleAddCustomEvent}
                        className="mb-3 rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 text-xs space-y-2.5"
                      >
                        <p className="font-bold text-indigo-950 text-[11px] flex items-center gap-1">
                          <CalendarPlus className="h-3.5 w-3.5" />
                          新しい予定を追加（METs・TPOが即座に再計算されます）
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-zinc-500 block mb-0.5">開始時刻</label>
                            <input
                              type="time"
                              value={newEvent.start_time}
                              onChange={(e) =>
                                setNewEvent({ ...newEvent, start_time: e.target.value })
                              }
                              className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-500 block mb-0.5">終了時刻</label>
                            <input
                              type="time"
                              value={newEvent.end_time}
                              onChange={(e) =>
                                setNewEvent({ ...newEvent, end_time: e.target.value })
                              }
                              className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs"
                            />
                          </div>
                        </div>
                        <div>
                          <input
                            type="text"
                            placeholder="予定名（例: 渋谷オフィスMTG、雨の中散歩）"
                            value={newEvent.title}
                            onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                            className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setIsAddingEvent(false)}
                            className="rounded-lg px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-200"
                          >
                            キャンセル
                          </button>
                          <button
                            type="submit"
                            className="rounded-lg bg-indigo-700 px-3 py-1 text-xs font-bold text-white hover:bg-indigo-800"
                          >
                            追加して再計算
                          </button>
                        </div>
                      </form>
                    )}

                    <div className="space-y-2">
                      {events.map((ev, i) => {
                        const sanitized = trace?.sanitized_activities[i];
                        return (
                          <div
                            key={i}
                            className="group flex items-center justify-between rounded-xl bg-zinc-50 hover:bg-zinc-100/80 px-3 py-2 text-xs transition"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono text-zinc-400 text-[11px] shrink-0">
                                {ev.start_time}-{ev.end_time}
                              </span>
                              <span className="font-semibold text-zinc-800 truncate">
                                {ev.title}
                              </span>
                              {ev.location && (
                                <span className="text-[10px] text-zinc-400 shrink-0">
                                  @{ev.location}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              {sanitized && (
                                <span className="rounded-md bg-white border border-zinc-200 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
                                  {sanitized.activity_type} / {sanitized.estimated_mets} METs
                                </span>
                              )}
                              <button
                                onClick={() => handleDeleteEvent(i)}
                                className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-red-600 transition"
                                title="予定を削除"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <p className="text-[10px] text-zinc-400 pt-3 border-t border-zinc-100 mt-2">
                    ※ カレンダー予定の生テキストは保存されず、活動代謝量(METs)と要求フォーマル度に変換されます。
                  </p>
                </div>
              </div>
            )}

            {/* Outfit Proposals (3 Cards with Visual Photo Collage) */}
            <section className="space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
                    <span>本日のベストコーディネート提案</span>
                    {trace && (
                      <span className="rounded-full bg-zinc-900 px-2.5 py-0.5 text-xs font-semibold text-white">
                        目標断熱性 {trace.target_clo_min}〜{trace.target_clo_max} Clo
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    被服気候学の数理制約を満たし、死蔵衣類と視覚調和を両立した上位3案
                  </p>
                </div>
                {loading && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500 font-medium">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    最適化計算中...
                  </span>
                )}
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                {outfits.map((outfit) => {
                  const isChosen = selectedOutfitRank === outfit.rank;
                  return (
                    <div
                      key={outfit.rank}
                      className={`flex flex-col justify-between rounded-2xl border bg-white p-5 transition-all duration-200 shadow-2xs ${
                        isChosen
                          ? "border-zinc-900 ring-2 ring-zinc-900/10 shadow-md"
                          : "border-zinc-200 hover:border-zinc-300"
                      }`}
                    >
                      <div className="space-y-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                              Option 0{outfit.rank}
                            </span>
                            <h3 className="text-base font-bold text-zinc-900">
                              {outfit.title}
                            </h3>
                          </div>
                          <span className="shrink-0 rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-mono font-bold text-zinc-800">
                            {outfit.total_clo} Clo
                          </span>
                        </div>

                        {outfit.revived_dormant_ids.length > 0 && (
                          <div className="flex items-center gap-1.5 rounded-xl bg-amber-50 border border-amber-200/80 px-3 py-1.5 text-xs font-bold text-amber-900">
                            <Flame className="h-4 w-4 text-amber-600 shrink-0" />
                            <span>眠っていた服（30日以上未着用）を再活用！</span>
                          </div>
                        )}

                        {/* Visual Clothing Photo Collage (服の写真グリッド表示) */}
                        <div className="grid grid-cols-2 gap-2">
                          {outfit.items.map((item) => {
                            const isDormant = outfit.revived_dormant_ids.includes(item.id);
                            return (
                              <div
                                key={item.id}
                                onClick={() => setSelectedItemDetail(item)}
                                className="group relative flex flex-col overflow-hidden rounded-xl border border-zinc-200/80 bg-zinc-50 cursor-pointer hover:border-zinc-400 transition"
                              >
                                <div className="relative aspect-4/3 w-full bg-zinc-100 overflow-hidden">
                                  {item.image_url ? (
                                    <img
                                      src={item.image_url}
                                      alt={item.name}
                                      className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-zinc-300">
                                      <Shirt className="h-8 w-8" />
                                    </div>
                                  )}
                                  <span className="absolute top-1.5 left-1.5 rounded bg-black/60 backdrop-blur-xs px-1.5 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider">
                                    {CATEGORY_LABELS[item.category]}
                                  </span>
                                  {isDormant && (
                                    <span className="absolute top-1.5 right-1.5 rounded bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-xs">
                                      Revival
                                    </span>
                                  )}
                                </div>

                                <div className="p-2">
                                  <p className="text-[11px] font-bold text-zinc-900 truncate">
                                    {item.name}
                                  </p>
                                  <div className="flex items-center justify-between text-[10px] text-zinc-500 mt-0.5">
                                    <span>{item.colors[0]}</span>
                                    <span className="font-mono font-semibold">{item.clo_value} Clo</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Stylist Explanation */}
                        <div className="space-y-2 rounded-xl bg-zinc-50 p-3.5 text-xs leading-relaxed text-zinc-700">
                          <p>
                            <strong className="text-zinc-900">推薦理由：</strong>
                            {outfit.reason}
                          </p>
                          <p className="text-zinc-600 border-t border-zinc-200/70 pt-2">
                            <strong className="text-zinc-800">気象アドバイス：</strong>
                            {outfit.weather_advice}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 pt-3.5 border-t border-zinc-100 space-y-3">
                        <div className="grid grid-cols-4 gap-1 text-center text-[10px] text-zinc-500">
                          <div>
                            <span className="block font-mono font-bold text-zinc-800">
                              {Math.round(outfit.score_breakdown.physics_clo_fit * 100)}
                            </span>
                            物理断熱
                          </div>
                          <div>
                            <span className="block font-mono font-bold text-zinc-800">
                              {Math.round(outfit.score_breakdown.tpo_formality_fit * 100)}
                            </span>
                            TPO適合
                          </div>
                          <div>
                            <span className="block font-mono font-bold text-zinc-800">
                              {Math.round(outfit.score_breakdown.vector_style_similarity * 100)}
                            </span>
                            Vector調和
                          </div>
                          <div>
                            <span className="block font-mono font-bold text-zinc-800">
                              {Math.round(outfit.score_breakdown.dormancy_revival_score * 100)}
                            </span>
                            死蔵活用
                          </div>
                        </div>

                        <button
                          onClick={() => handleWearOutfit(outfit)}
                          className={`w-full rounded-xl py-2.5 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                            isChosen
                              ? "bg-emerald-600 text-white shadow-sm"
                              : "bg-zinc-900 text-white hover:bg-zinc-800"
                          }`}
                        >
                          {isChosen ? (
                            <>
                              <Check className="h-4 w-4" />
                              <span>✓ 本日の着用コーデとして記録しました</span>
                            </>
                          ) : (
                            "今日これを着る（着用履歴・稼働率を更新）"
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Own the Why: Pipeline Observability Trace (Cloud Logging連携) */}
            {trace && (
              <section className="rounded-2xl border border-zinc-200 bg-zinc-950 text-zinc-100 p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-zinc-800">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-emerald-400" />
                    <h3 className="text-sm font-bold">
                      Own the Why — 3段階ハイブリッド推論トレース (Cloud Logging 構造化連携)
                    </h3>
                  </div>
                  <span className="font-mono text-xs text-zinc-400">
                    Engine: {trace.inference_engine} | {trace.latency_ms} ms
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 pt-4 text-xs">
                  <div className="rounded-xl bg-zinc-900 p-3.5 border border-zinc-800">
                    <p className="text-emerald-400 font-bold mb-1">
                      Stage 1: 被服気候学 CSP 物理ソルバー
                    </p>
                    <p className="text-zinc-300 leading-relaxed">
                      平均活動量 <strong>{trace.average_mets} METs</strong> と気温・風速から目標断熱性を{" "}
                      <strong>
                        {trace.target_clo_min}〜{trace.target_clo_max} Clo
                      </strong>{" "}
                      と算出。全 <strong>{trace.total_combinations_explored}通り</strong> から熱的・撥水制約を満たす{" "}
                      <strong className="text-emerald-400">{trace.stage1_physics_passed}通り</strong> に絞り込み。
                    </p>
                  </div>

                  <div className="rounded-xl bg-zinc-900 p-3.5 border border-zinc-800">
                    <p className="text-sky-400 font-bold mb-1">
                      Stage 2: Multimodal Vector × 死蔵衣類発掘
                    </p>
                    <p className="text-zinc-300 leading-relaxed">
                      Vertex AI 1408次元スタイルベクトル類似度で調和を評価しつつ、30日以上未着用の服に{" "}
                      <strong className="text-sky-400">Dormancy Revival Boost</strong> を付与して新しい着回しを発掘。
                    </p>
                  </div>

                  <div className="rounded-xl bg-zinc-900 p-3.5 border border-zinc-800">
                    <p className="text-amber-400 font-bold mb-1">
                      Stage 3: Vertex AI Gemini 構造化リランカー
                    </p>
                    <p className="text-zinc-300 leading-relaxed">
                      要求フォーマル度 (Lv.{trace.required_formality}) と色彩調和を多基準評価し、JSON Schema 検証・手持ちID実在チェックを通過した上位3案を出力。
                    </p>
                  </div>
                </div>
              </section>
            )}
          </>
        ) : (
          /* Closet Management & AI Photo Upload Tab */
          <section className="space-y-6">
            {/* AI Photo Upload Card */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    <span>写真から手持ち服を追加（Vertex AI 自動タグ & Clo値推定）</span>
                  </h2>
                  <p className="text-xs text-zinc-500 mt-1">
                    服の写真をアップロードすると、カテゴリ・色・断熱性(Clo値)・1408次元ベクトルを自動抽出し、クローゼットに登録します。
                  </p>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-zinc-800 shrink-0 transition">
                  <Plus className="h-4 w-4" />
                  <span>{analyzingPhoto ? "AI解析中..." : "服の写真を選択"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={analyzingPhoto}
                  />
                </label>
              </div>

              {previewPhotoUrl && analyzedDraft && (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-950">
                      AI解析結果（内容を確認してクローゼットに追加できます）
                    </span>
                    <span className="font-mono text-[11px] text-emerald-700 font-semibold">
                      Vector: {analyzedDraft.embedding_dimensions} dim ({analyzedDraft.analysis_source})
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 items-center">
                    <div className="h-28 w-28 rounded-xl overflow-hidden border border-emerald-200 bg-white shrink-0">
                      <img
                        src={previewPhotoUrl}
                        alt="アップロードプレビュー"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-4 text-xs flex-1 w-full">
                      <div className="rounded-xl bg-white p-2.5 border border-emerald-100">
                        <span className="text-zinc-400 block text-[10px]">アイテム名</span>
                        <strong className="text-zinc-900">{analyzedDraft.suggested_name}</strong>
                      </div>
                      <div className="rounded-xl bg-white p-2.5 border border-emerald-100">
                        <span className="text-zinc-400 block text-[10px]">カテゴリ / 色</span>
                        <strong className="text-zinc-900">
                          {CATEGORY_LABELS[analyzedDraft.category]} / {analyzedDraft.colors.join("・")}
                        </strong>
                      </div>
                      <div className="rounded-xl bg-white p-2.5 border border-emerald-100">
                        <span className="text-zinc-400 block text-[10px]">断熱性 (Clo値)</span>
                        <strong className="text-zinc-900">{analyzedDraft.clo_value} Clo</strong>
                      </div>
                      <div className="rounded-xl bg-white p-2.5 border border-emerald-100">
                        <span className="text-zinc-400 block text-[10px]">フォーマル度</span>
                        <strong className="text-zinc-900">Lv.{analyzedDraft.formality} / 5</strong>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-emerald-100">
                    <button
                      onClick={() => {
                        setAnalyzedDraft(null);
                        setPreviewPhotoUrl(null);
                      }}
                      className="rounded-lg px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-200/60"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={handleConfirmAddClothing}
                      className="rounded-lg bg-emerald-700 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 transition"
                    >
                      クローゼットに登録して再推論する
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Wardrobe Controls & Grid */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-zinc-600" />
                  <h3 className="text-sm font-bold text-zinc-900">
                    登録済みクローゼット（全{wardrobe.length}着 / うち死蔵予備軍{" "}
                    <span className="text-amber-600">{dormantCount}着</span>）
                  </h3>
                </div>

                {/* カテゴリ & 死蔵フィルタ */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      { key: "all", label: "すべて" },
                      { key: "top", label: "トップス" },
                      { key: "bottom", label: "ボトムス" },
                      { key: "outer", label: "アウター" },
                      { key: "shoes", label: "シューズ" },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setSelectedCategory(tab.key)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                        selectedCategory === tab.key
                          ? "bg-zinc-900 text-white"
                          : "bg-white border border-zinc-200 text-zinc-600 hover:border-zinc-400"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                  <button
                    onClick={() => setFilterDormantOnly(!filterDormantOnly)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition flex items-center gap-1 ${
                      filterDormantOnly
                        ? "bg-amber-500 text-white"
                        : "bg-white border border-amber-200 text-amber-800 hover:border-amber-400"
                    }`}
                  >
                    <Flame className="h-3 w-3" />
                    <span>死蔵のみ</span>
                  </button>
                </div>
              </div>

              {/* Clothes Grid with Visual Photos */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredWardrobe.map((item) => {
                  const isDormant = item.days_since_last_worn >= 30;
                  const isLaundry = item.availability === "laundry";
                  return (
                    <div
                      key={item.id}
                      className={`group rounded-2xl border bg-white overflow-hidden transition-all duration-200 shadow-2xs ${
                        isLaundry
                          ? "opacity-55 border-zinc-200"
                          : isDormant
                          ? "border-amber-300 ring-1 ring-amber-300/40"
                          : "border-zinc-200 hover:border-zinc-300"
                      }`}
                    >
                      {/* 写真部分 */}
                      <div
                        onClick={() => setSelectedItemDetail(item)}
                        className="relative aspect-16/10 w-full bg-zinc-100 overflow-hidden cursor-pointer"
                      >
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-zinc-300">
                            <Shirt className="h-10 w-10" />
                          </div>
                        )}
                        <span className="absolute top-2 left-2 rounded-md bg-black/60 backdrop-blur-xs px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                          {CATEGORY_LABELS[item.category]}
                        </span>
                        {isDormant && (
                          <span className="absolute top-2 right-2 rounded-md bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs flex items-center gap-1">
                            <Flame className="h-3 w-3" />
                            <span>{item.days_since_last_worn}日未着用</span>
                          </span>
                        )}
                        {item.water_resistant && (
                          <span className="absolute bottom-2 left-2 rounded bg-blue-600/80 backdrop-blur-xs px-1.5 py-0.5 text-[9px] font-bold text-white">
                            撥水仕様
                          </span>
                        )}
                      </div>

                      {/* メタデータ */}
                      <div className="p-4 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-sm font-bold text-zinc-900 truncate">
                            {item.name}
                          </h4>
                          <span className="font-mono text-xs font-bold text-zinc-800 shrink-0">
                            {item.clo_value} Clo
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1 text-[11px] text-zinc-600">
                          <span className="rounded bg-zinc-100 px-1.5 py-0.5">
                            {item.colors.join("・")}
                          </span>
                          <span className="rounded bg-zinc-100 px-1.5 py-0.5">
                            フォーマル Lv.{item.formality}
                          </span>
                        </div>

                        <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-xs">
                          <span className="text-zinc-500 text-[11px]">
                            着用 {item.wear_count}回
                          </span>
                          <button
                            onClick={() => handleToggleLaundry(item.id)}
                            className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                              isLaundry
                                ? "bg-amber-600 text-white"
                                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                            }`}
                          >
                            {isLaundry ? "洗濯中（除外中）" : "着用可能"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* 衣服詳細モーダル */}
        {selectedItemDetail && (
          <div
            onClick={() => setSelectedItemDetail(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  {CATEGORY_LABELS[selectedItemDetail.category]}
                </span>
                <button
                  onClick={() => setSelectedItemDetail(null)}
                  className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {selectedItemDetail.image_url && (
                <div className="aspect-4/3 w-full rounded-xl overflow-hidden bg-zinc-100">
                  <img
                    src={selectedItemDetail.image_url}
                    alt={selectedItemDetail.name}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}

              <div>
                <h3 className="text-lg font-bold text-zinc-900">
                  {selectedItemDetail.name}
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  カラー: {selectedItemDetail.colors.join("・")} | スタイル:{" "}
                  {selectedItemDetail.style_tags.join(", ") || "ベーシック"}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-xl bg-zinc-50 p-2.5 border border-zinc-100">
                  <span className="text-[10px] text-zinc-400 block">被服断熱性</span>
                  <span className="font-mono font-bold text-sm">{selectedItemDetail.clo_value} Clo</span>
                </div>
                <div className="rounded-xl bg-zinc-50 p-2.5 border border-zinc-100">
                  <span className="text-[10px] text-zinc-400 block">フォーマル度</span>
                  <span className="font-bold text-sm">Lv.{selectedItemDetail.formality} / 5</span>
                </div>
                <div className="rounded-xl bg-zinc-50 p-2.5 border border-zinc-100">
                  <span className="text-[10px] text-zinc-400 block">死蔵日数</span>
                  <span className="font-bold text-sm text-amber-600">
                    {selectedItemDetail.days_since_last_worn} 日前
                  </span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSelectedItemDetail(null)}
                  className="w-full rounded-xl bg-zinc-900 py-2.5 text-xs font-bold text-white hover:bg-zinc-800"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

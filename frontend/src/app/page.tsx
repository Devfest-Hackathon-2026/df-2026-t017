"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  CloudRain,
  Cpu,
  Flame,
  Layers,
  Plus,
  RefreshCw,
  ShieldCheck,
  Shirt,
  Sparkles,
  Sun,
  Thermometer,
  Upload,
  Wind,
} from "lucide-react";
import {
  analyzeClothingPhoto,
  fetchDemoContext,
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

export default function ClosetMeApp() {
  const [activeTab, setActiveTab] = useState<"today" | "closet">("today");
  const [wardrobe, setWardrobe] = useState<ClothingItem[]>([]);
  const [presets, setPresets] = useState<DemoPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");

  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [events, setEvents] = useState<RawCalendarEvent[]>([]);
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

  // 服追加フォーム用State
  const [analyzingPhoto, setAnalyzingPhoto] = useState<boolean>(false);
  const [analyzedDraft, setAnalyzedDraft] =
    useState<AnalyzeClothingResponse | null>(null);

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
            : "バックエンドエンジンへの接続に失敗しました（uvicorn 起動を確認してください）。"
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
          "FastAPI バックエンド (http://localhost:8080) に接続できません。backend ディレクトリでサーバーを起動してください。"
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
      style_tags: analyzedDraft.style_tags,
    };
    const updated = [newItem, ...wardrobe];
    setWardrobe(updated);
    setAnalyzedDraft(null);
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

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-zinc-900 pb-16">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-zinc-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">Closet Me</h1>
              <p className="text-[11px] text-zinc-500">
                被服気候学(Clo値) × Vertex AI スタイリスト
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5" />
              クローゼット稼働率 {utilizationRate}%
            </span>
            <div className="flex rounded-lg bg-zinc-100 p-1">
              <button
                onClick={() => setActiveTab("today")}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  activeTab === "today"
                    ? "bg-white text-zinc-900 shadow-xs"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                今日の3案
              </button>
              <button
                onClick={() => setActiveTab("closet")}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
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

      <main className="mx-auto max-w-5xl px-4 pt-6 space-y-6">
        {/* Demo Scenario Bar */}
        {presets.length > 0 && (
          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-700">
                <span className="rounded-md bg-amber-100 px-2 py-0.5 text-amber-800">
                  1-Click デモ検証
                </span>
                <span>予定・気象シナリオを切り替えて推論の変化を比較:</span>
              </div>
              <select
                value={selectedPresetId}
                onChange={(e) => handleSelectPreset(e.target.value)}
                className="rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-800 focus:border-zinc-900 focus:outline-none"
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
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        {activeTab === "today" ? (
          <>
            {/* Context Grid: Weather + Schedule */}
            {weather && (
              <div className="grid gap-4 md:grid-cols-2">
                {/* Weather Card */}
                <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      {weather.rain_probability >= 0.5 ? (
                        <CloudRain className="h-4 w-4 text-blue-600" />
                      ) : (
                        <Sun className="h-4 w-4 text-amber-500" />
                      )}
                      <span>{weather.location_name} の気象推移</span>
                    </div>
                    <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700">
                      {weather.condition_label}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center my-3">
                    <div className="rounded-xl bg-zinc-50 p-2.5">
                      <p className="text-[11px] text-zinc-500">朝 (08:00)</p>
                      <p className="text-lg font-bold">{weather.morning_temp_c}℃</p>
                    </div>
                    <div className="rounded-xl bg-zinc-50 p-2.5">
                      <p className="text-[11px] text-zinc-500">昼 (14:00)</p>
                      <p className="text-lg font-bold">{weather.afternoon_temp_c}℃</p>
                    </div>
                    <div className="rounded-xl bg-zinc-50 p-2.5">
                      <p className="text-[11px] text-zinc-500">夜 (20:00)</p>
                      <p className="text-lg font-bold">{weather.evening_temp_c}℃</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-zinc-600 pt-2 border-t border-zinc-100">
                    <span className="flex items-center gap-1">
                      <Wind className="h-3.5 w-3.5" /> 風速 {weather.wind_speed_ms} m/s
                    </span>
                    <span>降水確率 {Math.round(weather.rain_probability * 100)}%</span>
                    <div className="flex items-center gap-1">
                      <Thermometer className="h-3.5 w-3.5" />
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
                          className={`rounded px-1.5 py-0.5 text-[11px] transition ${
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

                {/* Google Calendar Card */}
                <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      <Calendar className="h-4 w-4 text-indigo-600" />
                      <span>Google Calendar 連携予定</span>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-medium text-indigo-700">
                      <ShieldCheck className="h-3 w-3" /> PII サニタイズ済
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {events.map((ev, i) => {
                      const sanitized = trace?.sanitized_activities[i];
                      return (
                        <div
                          key={i}
                          className="flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2 text-xs"
                        >
                          <div>
                            <span className="font-mono text-zinc-500 mr-2">
                              {ev.start_time}-{ev.end_time}
                            </span>
                            <span className="font-semibold text-zinc-800">
                              {ev.title}
                            </span>
                          </div>
                          {sanitized && (
                            <span className="rounded-md bg-white border border-zinc-200 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
                              {sanitized.activity_type} / {sanitized.estimated_mets} METs
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Outfit Proposals (3 Cards) */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
                  <span>本日のベストコーディネート提案</span>
                  {trace && (
                    <span className="rounded-full bg-zinc-900 px-2.5 py-0.5 text-xs font-medium text-white">
                      目標断熱性 {trace.target_clo_min}〜{trace.target_clo_max} Clo
                    </span>
                  )}
                </h2>
                {loading && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
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
                      className={`flex flex-col justify-between rounded-2xl border bg-white p-5 transition shadow-2xs ${
                        isChosen
                          ? "border-zinc-900 ring-2 ring-zinc-900/10"
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
                          <span className="shrink-0 rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-mono font-semibold text-zinc-800">
                            {outfit.total_clo} Clo
                          </span>
                        </div>

                        {outfit.revived_dormant_ids.length > 0 && (
                          <div className="flex items-center gap-1.5 rounded-xl bg-amber-50 border border-amber-200/80 px-3 py-1.5 text-xs font-medium text-amber-900">
                            <Flame className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                            <span>
                              眠っていた服（30日以上未着用）を再活用！
                            </span>
                          </div>
                        )}

                        {/* Clothing Items List */}
                        <div className="space-y-2">
                          {outfit.items.map((item) => {
                            const isDormant = outfit.revived_dormant_ids.includes(
                              item.id
                            );
                            return (
                              <div
                                key={item.id}
                                className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50/70 px-3 py-2 text-xs"
                              >
                                <div className="min-w-0">
                                  <span className="text-[10px] font-semibold text-zinc-400 block">
                                    {CATEGORY_LABELS[item.category]}
                                  </span>
                                  <span className="font-semibold text-zinc-800 truncate block">
                                    {item.name}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                  {isDormant && (
                                    <span className="rounded bg-amber-200/70 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                                      Revival
                                    </span>
                                  )}
                                  <span className="text-[11px] text-zinc-500">
                                    {item.colors[0]}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Stylist Explanation */}
                        <div className="space-y-2 rounded-xl bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-700">
                          <p>
                            <strong className="text-zinc-900">推薦理由：</strong>
                            {outfit.reason}
                          </p>
                          <p className="text-zinc-600 border-t border-zinc-200/70 pt-1.5">
                            <strong className="text-zinc-800">気象対策：</strong>
                            {outfit.weather_advice}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-zinc-100 space-y-3">
                        <div className="grid grid-cols-4 gap-1 text-center text-[10px] text-zinc-500">
                          <div>
                            <span className="block font-mono font-semibold text-zinc-800">
                              {Math.round(outfit.score_breakdown.physics_clo_fit * 100)}
                            </span>
                            物理断熱
                          </div>
                          <div>
                            <span className="block font-mono font-semibold text-zinc-800">
                              {Math.round(outfit.score_breakdown.tpo_formality_fit * 100)}
                            </span>
                            TPO適合
                          </div>
                          <div>
                            <span className="block font-mono font-semibold text-zinc-800">
                              {Math.round(
                                outfit.score_breakdown.vector_style_similarity * 100
                              )}
                            </span>
                            Vector調和
                          </div>
                          <div>
                            <span className="block font-mono font-semibold text-zinc-800">
                              {Math.round(
                                outfit.score_breakdown.dormancy_revival_score * 100
                              )}
                            </span>
                            死蔵活用
                          </div>
                        </div>

                        <button
                          onClick={() => handleWearOutfit(outfit)}
                          className={`w-full rounded-xl py-2.5 text-xs font-bold transition ${
                            isChosen
                              ? "bg-emerald-600 text-white"
                              : "bg-zinc-900 text-white hover:bg-zinc-800"
                          }`}
                        >
                          {isChosen
                            ? "✓ 本日の着用コーデとして記録しました"
                            : "今日これを着る（履歴・稼働率を更新）"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Own the Why: Pipeline Observability Trace */}
            {trace && (
              <section className="rounded-2xl border border-zinc-200 bg-zinc-900 text-zinc-100 p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-zinc-800">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-emerald-400" />
                    <h3 className="text-sm font-bold">
                      Own the Why — 3段階ハイブリッド推論トレース (Cloud Logging 連携)
                    </h3>
                  </div>
                  <span className="font-mono text-xs text-zinc-400">
                    Engine: {trace.inference_engine} | {trace.latency_ms} ms
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 pt-4 text-xs">
                  <div className="rounded-xl bg-zinc-800/80 p-3.5">
                    <p className="text-emerald-400 font-semibold mb-1">
                      Stage 1: 被服気候学 CSP 物理ソルバー
                    </p>
                    <p className="text-zinc-300 leading-relaxed">
                      平均活動量 <strong>{trace.average_mets} METs</strong> と気温・風速から目標断熱性を{" "}
                      <strong>
                        {trace.target_clo_min}〜{trace.target_clo_max} Clo
                      </strong>{" "}
                      と算出。全 <strong>{trace.total_combinations_explored}通り</strong> から熱的・撥水制約を満たす{" "}
                      <strong>{trace.stage1_physics_passed}通り</strong> に絞り込み。
                    </p>
                  </div>

                  <div className="rounded-xl bg-zinc-800/80 p-3.5">
                    <p className="text-sky-400 font-semibold mb-1">
                      Stage 2: Multimodal Vector × 死蔵衣類発掘
                    </p>
                    <p className="text-zinc-300 leading-relaxed">
                      Vertex AI 1408次元ベクトル類似度でスタイル調和を計算しつつ、30日以上未着用の死蔵衣類に{" "}
                      <strong>Dormancy Revival Boost</strong> を付与して新しい着回しを発掘。
                    </p>
                  </div>

                  <div className="rounded-xl bg-zinc-800/80 p-3.5">
                    <p className="text-amber-400 font-semibold mb-1">
                      Stage 3: Vertex AI Gemini 構造化リランカー
                    </p>
                    <p className="text-zinc-300 leading-relaxed">
                      要求フォーマル度 (Lv.{trace.required_formality}) と色彩調和を評価し、JSON Schema 検証と所有ID実在チェックを通過した上位3案を出力。
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
                    服の写真をアップロードすると、カテゴリ・色・断熱性(Clo値)・1408次元スタイルベクトルを自動抽出します。
                  </p>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-zinc-800 shrink-0">
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

              {analyzedDraft && (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-900">
                      AI解析結果（登録前に確認・追加できます）
                    </span>
                    <span className="font-mono text-[11px] text-emerald-700">
                      Vector: {analyzedDraft.embedding_dimensions} dim ({analyzedDraft.analysis_source})
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-4 text-xs">
                    <div className="rounded-lg bg-white p-2.5 border border-emerald-100">
                      <span className="text-zinc-400 block text-[10px]">アイテム名</span>
                      <strong>{analyzedDraft.suggested_name}</strong>
                    </div>
                    <div className="rounded-lg bg-white p-2.5 border border-emerald-100">
                      <span className="text-zinc-400 block text-[10px]">カテゴリ / 色</span>
                      <strong>
                        {CATEGORY_LABELS[analyzedDraft.category]} /{" "}
                        {analyzedDraft.colors.join("・")}
                      </strong>
                    </div>
                    <div className="rounded-lg bg-white p-2.5 border border-emerald-100">
                      <span className="text-zinc-400 block text-[10px]">推定断熱性 (Clo値)</span>
                      <strong>{analyzedDraft.clo_value} Clo</strong>
                    </div>
                    <div className="rounded-lg bg-white p-2.5 border border-emerald-100">
                      <span className="text-zinc-400 block text-[10px]">フォーマル度</span>
                      <strong>Lv.{analyzedDraft.formality} / 5</strong>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setAnalyzedDraft(null)}
                      className="rounded-lg px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-200/60"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={handleConfirmAddClothing}
                      className="rounded-lg bg-emerald-700 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-800"
                    >
                      クローゼットに登録して再推論する
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Wardrobe Grid */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-zinc-800 flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  <span>
                    登録済みクローゼット（全{wardrobe.length}着 / うち死蔵予備軍{" "}
                    {dormantCount}着）
                  </span>
                </h3>
                <span className="text-xs text-zinc-500">
                  「洗濯中」に切り替えるとStage 1で即座に候補から除外されます
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {wardrobe.map((item) => {
                  const isDormant = item.days_since_last_worn >= 30;
                  const isLaundry = item.availability === "laundry";
                  return (
                    <div
                      key={item.id}
                      className={`rounded-2xl border p-4 bg-white transition ${
                        isLaundry
                          ? "opacity-55 border-zinc-200"
                          : isDormant
                          ? "border-amber-300"
                          : "border-zinc-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-bold uppercase text-zinc-400">
                            {CATEGORY_LABELS[item.category]}
                          </span>
                          <h4 className="text-sm font-bold text-zinc-900">
                            {item.name}
                          </h4>
                        </div>
                        <Shirt className="h-4 w-4 text-zinc-400 shrink-0" />
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                        <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono">
                          {item.clo_value} Clo
                        </span>
                        <span className="rounded-md bg-zinc-100 px-2 py-0.5">
                          フォーマル Lv.{item.formality}
                        </span>
                        {item.water_resistant && (
                          <span className="rounded-md bg-blue-50 text-blue-700 px-2 py-0.5 font-medium">
                            撥水対応
                          </span>
                        )}
                        {isDormant && (
                          <span className="rounded-md bg-amber-100 text-amber-900 px-2 py-0.5 font-semibold">
                            {item.days_since_last_worn}日間未着用（死蔵）
                          </span>
                        )}
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-zinc-100 flex items-center justify-between text-xs">
                        <span className="text-zinc-500">
                          累計着用 {item.wear_count}回
                        </span>
                        <button
                          onClick={() => handleToggleLaundry(item.id)}
                          className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                            isLaundry
                              ? "bg-amber-600 text-white"
                              : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                          }`}
                        >
                          {isLaundry ? "洗濯中（除外）" : "着用可能"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

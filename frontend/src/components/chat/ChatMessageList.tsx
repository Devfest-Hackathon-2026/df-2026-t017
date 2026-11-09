"use client";

import React, { useState } from "react";
import {
  ArrowLeftRight,
  Calendar,
  CalendarPlus,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Cloud,
  CloudRain,
  CloudSun,
  Droplets,
  ExternalLink,
  Flame,
  Home,
  Layers,
  LocateFixed,
  MapPin,
  Moon,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Shirt,
  Sparkles,
  Sun,
  Thermometer,
  Trash2,
  Umbrella,
  Wind,
} from "lucide-react";
import {
  AnalyzeClothingResponse,
  ClothingCategory,
  ClothingItem,
  OutfitProposal,
  ChatMessage,
  RawCalendarEvent,
  SwapCandidateItem,
} from "@/types/closet";

const CATEGORY_LABELS: Record<ClothingCategory, string> = {
  top: "トップス",
  bottom: "ボトムス",
  outer: "アウター",
  shoes: "シューズ",
};

interface ChatMessageListProps {
  messages: ChatMessage[];
  onOpenSwap: (outfitRank: number, category: ClothingCategory, currentItemIds: string[]) => void;
  onApplySwap: (newItem: ClothingItem, outfitRank: number) => void;
  onWearOutfit: (proposal: OutfitProposal) => void;
  onConfirmAddClothing: (draft: AnalyzeClothingResponse, imageUrl?: string | null) => void;
  onItemDetail: (item: ClothingItem) => void;
  onOpenLocationModal: () => void;
  onOpenClosetDrawer: () => void;
  onSelectCity?: (cityName: string) => void;
  onGetLocation?: () => void;
  onSetHomeLocation?: (locName: string) => void;
  onAddEvent?: (ev: RawCalendarEvent) => void;
  onDeleteEvent?: (idx: number) => void;
  onConnectGoogleCalendar?: (forceDemo?: boolean) => void;
  onDisconnectGoogleCalendar?: () => void;
  isGCalLoading?: boolean;
  selectedOutfitRank: number | null;
  isCalendarSaving: boolean;
  isLoading: boolean;
  wardrobe?: ClothingItem[];
  onToggleLaundry?: (itemId: string) => void;
  onDeleteItem?: (itemId: string) => void;
  onResetToDemo?: () => void;
  onTriggerPhotoUpload?: () => void;
  onAddManualItem?: (item: ClothingItem) => void;
  onComfortFeedback?: (feedback: "cold" | "optimal" | "warm", outfit: OutfitProposal) => void;
  feedbackSubmittedRank?: number | null;
  gcalStatus?: "disconnected" | "connected_real" | "connected_demo";
}

export function ChatMessageList({
  messages,
  onOpenSwap,
  onApplySwap,
  onWearOutfit,
  onConfirmAddClothing,
  onItemDetail,
  onOpenLocationModal,
  onOpenClosetDrawer,
  onSelectCity,
  onGetLocation,
  onSetHomeLocation,
  onAddEvent,
  onDeleteEvent,
  onConnectGoogleCalendar,
  onDisconnectGoogleCalendar,
  isGCalLoading = false,
  selectedOutfitRank,
  isCalendarSaving,
  isLoading,
  wardrobe = [],
  onToggleLaundry,
  onDeleteItem,
  onResetToDemo,
  onTriggerPhotoUpload,
  onAddManualItem,
  onComfortFeedback,
  feedbackSubmittedRank,
  gcalStatus = "disconnected",
}: ChatMessageListProps) {
  // コーデごとに「理由を知る」を開閉するトグル状態（outfitRank単位）
  const [expandedOutfitRanks, setExpandedOutfitRanks] = useState<Record<number, boolean>>({});

  // チャット内予定追加フォーム
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: "",
    start_time: "14:00",
    end_time: "16:00",
    location: "",
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.title.trim() || !onAddEvent) return;
    onAddEvent({
      title: newEvent.title.trim(),
      start_time: newEvent.start_time,
      end_time: newEvent.end_time,
      location: newEvent.location.trim() || undefined,
    });
    setNewEvent({ title: "", start_time: "14:00", end_time: "16:00", location: "" });
    setIsAddingEvent(false);
  };

  const toggleOutfitReason = (rank: number) => {
    setExpandedOutfitRanks((prev) => ({
      ...prev,
      [rank]: !prev[rank],
    }));
  };

  return (
    <div className="flex-1 space-y-4 px-3 py-3 sm:px-4 sm:py-5 pb-32 sm:pb-36 max-w-3xl mx-auto w-full">
      {messages.map((msg) => {
        const isUser = msg.sender === "user";

        return (
          <div
            key={msg.id}
            className={`flex flex-col ${isUser ? "items-end" : "items-start"} space-y-1`}
          >
            {/* 送信者ラベル（ミニマルなタイポグラフィ） */}
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 px-1">
              {!isUser && (
                <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-zinc-900 text-white text-[8px] font-bold">
                  C
                </div>
              )}
              <span className="font-medium text-zinc-500">{isUser ? "あなた" : "Closet Me"}</span>
              <span>•</span>
              <span>{msg.timestamp}</span>
            </div>

            {/* 吹き出しテキスト */}
            {msg.text && (
              <div
                className={`rounded-2xl px-3.5 py-2 text-xs sm:text-sm leading-relaxed max-w-[88%] sm:max-w-[80%] ${
                  isUser
                    ? "bg-zinc-900 text-white rounded-tr-xs"
                    : "bg-white border border-zinc-200/70 text-zinc-800 rounded-tl-xs shadow-2xs"
                }`}
              >
                {msg.imageUrl && (
                  <div className="mb-2 max-w-xs overflow-hidden rounded-xl border border-zinc-200">
                    <img src={msg.imageUrl} alt="添付画像" className="h-40 w-full object-cover" />
                  </div>
                )}
                <p className="whitespace-pre-wrap">{msg.text}</p>
              </div>
            )}

            {/* リッチカードアタッチメント */}
            {msg.attachment && (
              <div className="w-full max-w-3xl pt-1">
                {/* 1. 朝のブリーフィングカード（ChatGPT風クリーンウィジェット） */}
                {msg.attachment.type === "briefing" && (() => {
                  const bWeather = msg.attachment.weather;
                  const isRain = bWeather.rain_probability >= 0.4 || bWeather.condition_label.includes("雨");
                  const shortCond = bWeather.condition_label.split("・")[0].split("（")[0];
                  return (
                    <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 sm:p-5 space-y-3.5 shadow-xs w-full max-w-lg">
                      {/* 上部: 地域名 + ステータスタグ */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-zinc-900 text-sm tracking-tight">
                          <MapPin className="h-4 w-4 text-zinc-500 shrink-0" />
                          <span>{bWeather.location_name}</span>
                        </div>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                          isRain
                            ? "bg-sky-50 text-sky-700 border-sky-200/60"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                        }`}>
                          {shortCond}
                        </span>
                      </div>

                      {/* 気温メイン */}
                      <div className="flex items-center justify-between pt-0.5">
                        <div className="flex items-center gap-3">
                          {isRain ? (
                            <CloudRain className="h-10 w-10 text-sky-500 shrink-0" />
                          ) : bWeather.condition_label.includes("曇") ? (
                            <CloudSun className="h-10 w-10 text-amber-500 shrink-0" />
                          ) : (
                            <Sun className="h-10 w-10 text-amber-500 shrink-0" />
                          )}
                          <div>
                            <div className="flex items-baseline gap-0.5">
                              <span className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900">
                                {bWeather.afternoon_temp_c}
                              </span>
                              <span className="text-xl text-zinc-600 font-normal">℃</span>
                            </div>
                            <div className="text-[11px] text-zinc-400 font-medium">現在の気温</div>
                          </div>
                        </div>
                        <div className="text-right text-xs text-zinc-500 space-y-0.5 font-mono">
                          <div>最高 <span className="font-semibold text-zinc-800">{bWeather.afternoon_temp_c}℃</span></div>
                          <div>最低 <span className="font-semibold text-zinc-800">{Math.min(bWeather.morning_temp_c, bWeather.evening_temp_c)}℃</span></div>
                        </div>
                      </div>

                      <div className="border-t border-zinc-100" />

                      {/* 時間帯の推移 */}
                      <div className="grid grid-cols-4 gap-2 text-center text-xs">
                        <div className="p-2 rounded-xl bg-zinc-50 border border-zinc-100/80">
                          <span className="text-[10px] text-zinc-400">朝</span>
                          <div className="font-semibold text-zinc-800 mt-0.5">{bWeather.morning_temp_c}℃</div>
                        </div>
                        <div className="p-2 rounded-xl bg-zinc-50 border border-zinc-100/80">
                          <span className="text-[10px] text-zinc-400">昼</span>
                          <div className="font-semibold text-zinc-800 mt-0.5">{bWeather.afternoon_temp_c}℃</div>
                        </div>
                        <div className="p-2 rounded-xl bg-zinc-50 border border-zinc-100/80">
                          <span className="text-[10px] text-zinc-400">夜</span>
                          <div className="font-semibold text-zinc-800 mt-0.5">{bWeather.evening_temp_c}℃</div>
                        </div>
                        <div className="p-2 rounded-xl bg-zinc-50 border border-zinc-100/80">
                          <span className="text-[10px] text-zinc-400">降水</span>
                          <div className="font-semibold text-zinc-800 mt-0.5">{Math.round(bWeather.rain_probability * 100)}%</div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* 1-B. 場所・気象設定カード（ChatGPT風天気ウィジェット + カード外アドバイス） */}
                {msg.attachment.type === "location_settings" && (() => {
                  const locAtt = msg.attachment;
                  const isHome = Boolean(
                    locAtt.homeLocation && locAtt.weather.location_name.includes(locAtt.homeLocation)
                  );
                  const isRain = locAtt.weather.rain_probability >= 0.4 || locAtt.weather.condition_label.includes("雨");
                  const shortCond = locAtt.weather.condition_label.split("・")[0].split("（")[0];

                  return (
                    <div className="space-y-3 w-full max-w-lg">
                      {/* ChatGPT風 天気ウィジェットカード（客観データに特化） */}
                      <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 sm:p-5 space-y-4 shadow-xs">
                        {/* 1. ヘッダー: 地域名 + 天候タグ */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-bold text-zinc-900 text-sm sm:text-base tracking-tight">
                            <MapPin className="h-4 w-4 text-zinc-500 shrink-0" />
                            <span>{locAtt.weather.location_name}</span>
                          </div>
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                            isRain
                              ? "bg-sky-50 text-sky-700 border-sky-200/60"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                          }`}>
                            {shortCond}
                          </span>
                        </div>

                        {/* 2. メイン気温表示 */}
                        <div className="flex items-center justify-between pt-0.5">
                          <div className="flex items-center gap-3">
                            {isRain ? (
                              <CloudRain className="h-11 w-11 text-sky-500 shrink-0" />
                            ) : locAtt.weather.condition_label.includes("曇") ? (
                              <CloudSun className="h-11 w-11 text-amber-500 shrink-0" />
                            ) : (
                              <Sun className="h-11 w-11 text-amber-500 shrink-0" />
                            )}
                            <div>
                              <div className="flex items-baseline gap-0.5">
                                <span className="text-4xl sm:text-5xl font-bold tracking-tight text-zinc-900">
                                  {locAtt.weather.afternoon_temp_c}
                                </span>
                                <span className="text-2xl text-zinc-600 font-normal">℃</span>
                              </div>
                              <div className="text-[11px] text-zinc-400 font-medium">現在の気温</div>
                            </div>
                          </div>
                          <div className="text-right text-xs text-zinc-500 space-y-0.5 font-mono">
                            <div>最高 <span className="font-semibold text-zinc-800">{locAtt.weather.afternoon_temp_c}℃</span></div>
                            <div>最低 <span className="font-semibold text-zinc-800">{Math.min(locAtt.weather.morning_temp_c, locAtt.weather.evening_temp_c)}℃</span></div>
                          </div>
                        </div>

                        <div className="border-t border-zinc-100" />

                        {/* 3. 今日の予報 */}
                        <div className="space-y-2 text-xs">
                          <div className="font-semibold text-zinc-900">今日の予報</div>
                          <ul className="space-y-1.5 text-zinc-600">
                            <li className="flex items-center gap-2">
                              <Sun className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                              <span>日中：{locAtt.weather.condition_label}</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <Thermometer className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                              <span>最高気温：{locAtt.weather.afternoon_temp_c}℃</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <Moon className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                              <span>夜：{locAtt.weather.evening_temp_c}℃前後</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <Droplets className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                              <span>降水確率：{Math.round(locAtt.weather.rain_probability * 100)}%</span>
                            </li>
                          </ul>
                        </div>

                        <div className="border-t border-zinc-100" />

                        {/* 4. これからの天気（時間帯別推移） */}
                        <div className="space-y-2 text-xs">
                          <div className="font-semibold text-zinc-900">これからの天気</div>
                          <div className="grid grid-cols-4 gap-2 pt-0.5">
                            <div className="flex flex-col items-center py-2 px-1 rounded-xl bg-zinc-50 border border-zinc-100/80 text-center">
                              <span className="text-[10px] text-zinc-400 font-medium">9時</span>
                              <Sun className="h-4 w-4 my-1 text-amber-500" />
                              <span className="text-xs font-semibold text-zinc-800">{locAtt.weather.morning_temp_c}℃</span>
                            </div>
                            <div className="flex flex-col items-center py-2 px-1 rounded-xl bg-zinc-50 border border-zinc-100/80 text-center">
                              <span className="text-[10px] text-zinc-400 font-medium">13時</span>
                              <Sun className="h-4 w-4 my-1 text-amber-500" />
                              <span className="text-xs font-semibold text-zinc-800">{locAtt.weather.afternoon_temp_c}℃</span>
                            </div>
                            <div className="flex flex-col items-center py-2 px-1 rounded-xl bg-zinc-50 border border-zinc-100/80 text-center">
                              <span className="text-[10px] text-zinc-400 font-medium">18時</span>
                              <CloudSun className="h-4 w-4 my-1 text-zinc-400" />
                              <span className="text-xs font-semibold text-zinc-800">{locAtt.weather.evening_temp_c}℃</span>
                            </div>
                            <div className="flex flex-col items-center py-2 px-1 rounded-xl bg-zinc-50 border border-zinc-100/80 text-center">
                              <span className="text-[10px] text-zinc-400 font-medium">21時</span>
                              <Moon className="h-4 w-4 my-1 text-indigo-400" />
                              <span className="text-xs font-semibold text-zinc-800">
                                {Math.round((locAtt.weather.evening_temp_c - 1.5) * 10) / 10}℃
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* 5. 下段: 操作アクション（現在地 / 居住区 / 主要都市） */}
                        <div className="border-t border-zinc-100 pt-3 space-y-2">
                          <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                            {onGetLocation && (
                              <button
                                onClick={onGetLocation}
                                className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 px-2.5 py-1 font-medium text-zinc-700 transition"
                              >
                                <LocateFixed className="h-3 w-3 text-zinc-500" />
                                <span>現在地</span>
                              </button>
                            )}

                            {locAtt.homeLocation && !isHome && onSelectCity && (
                              <button
                                onClick={() => onSelectCity(locAtt.homeLocation!)}
                                className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 px-2.5 py-1 font-medium text-zinc-700 transition"
                              >
                                <Home className="h-3 w-3 text-zinc-500" />
                                <span>居住区（{locAtt.homeLocation}）</span>
                              </button>
                            )}

                            {onSetHomeLocation && (
                              <button
                                onClick={() => onSetHomeLocation(locAtt.weather.location_name)}
                                disabled={isHome}
                                className={`rounded-lg px-2.5 py-1 font-medium transition ${
                                  isHome
                                    ? "text-zinc-400 cursor-default bg-zinc-50"
                                    : "border border-zinc-200 hover:border-zinc-400 text-zinc-600 hover:bg-zinc-50"
                                }`}
                              >
                                {isHome ? "✓ 居住区に登録済" : "ここを居住区にする"}
                              </button>
                            )}
                          </div>

                          {/* 主要都市クイックタグ */}
                          {onSelectCity && (
                            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none text-[11px]">
                              {["渋谷", "横浜", "梅田", "烏丸", "名古屋", "天神", "札幌", "仙台"].map((city) => (
                                <button
                                  key={city}
                                  onClick={() => onSelectCity(city)}
                                  className="shrink-0 rounded-lg px-2 py-0.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition"
                                >
                                  {city}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* カード外: コンシェルジュの「今日のお出かけアドバイス」（ChatGPTライク） */}
                      <div className="pt-2 px-1 text-xs text-zinc-700 space-y-2">
                        <div className="font-bold text-zinc-900 text-[13px]">今日のお出かけアドバイス</div>
                        <ul className="space-y-1.5 text-zinc-600 leading-relaxed">
                          <li className="flex items-start gap-2">
                            <span className="text-zinc-400 font-bold">•</span>
                            <span>
                              {locAtt.weather.afternoon_temp_c >= 20
                                ? "昼間は過ごしやすく、快適にお出かけできる陽気です。"
                                : locAtt.weather.afternoon_temp_c <= 12
                                ? "日中も空気が冷たいため、しっかりとした防寒対策がおすすめです。"
                                : "日中は適度な気温で、お出かけしやすい一日となります。"}
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-zinc-400 font-bold">•</span>
                            <span>
                              {Math.abs(locAtt.weather.afternoon_temp_c - locAtt.weather.evening_temp_c) >= 4
                                ? `夕方以降は${locAtt.weather.evening_temp_c}℃まで冷え込むため、カーディガンやジャケットなどの羽織りものがあると安心です。`
                                : "朝晩と日中の気温差は小さく、一定の服装で過ごしやすい見込みです。"}
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-zinc-400 font-bold">•</span>
                            <span>
                              {locAtt.umbrellaType === "umbrella" || locAtt.weather.rain_probability >= 0.5
                                ? "雨の可能性が高いため、しっかりした長傘とお足元の防水対策をおすすめします。"
                                : locAtt.umbrellaType === "folding" || locAtt.weather.rain_probability >= 0.2
                                ? "天候の急変やにわか雨に備えて、念のため折りたたみ傘を持っておくと安心です。"
                                : "雨の心配は少なく、傘を持たず身軽にお出かけできます。"}
                              {locAtt.destinationLocation && `（目的地: ${locAtt.destinationLocation}）`}
                            </span>
                          </li>
                        </ul>
                        <div className="pt-1 text-zinc-500 font-medium">
                          お出かけの際の参考にしてみてください。
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* 1-C. 予定・スケジュール設定カード（ChatGPT/Apple風 ミニマルUI） */}
                {msg.attachment.type === "schedule_settings" && (() => {
                  const schAtt = msg.attachment;
                  return (
                    <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 sm:p-5 space-y-3.5 shadow-xs w-full max-w-lg">
                      {/* 上段: 予定件数 & 同期状態 */}
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-zinc-500" />
                          <span className="font-bold text-zinc-900 text-sm">
                            本日の予定（{schAtt.events.length}件）
                          </span>
                        </div>
                        {schAtt.gcalStatus !== "disconnected" ? (
                          <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            <span>カレンダー同期中</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-zinc-400">手動設定</span>
                        )}
                      </div>

                      {/* 中段: 予定リスト */}
                      {schAtt.events.length === 0 ? (
                        <div className="rounded-xl bg-zinc-50 border border-zinc-100 p-5 text-center text-xs text-zinc-400">
                          本日の予定はありません。「予定を追加」またはGoogleカレンダーから同期できます。
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto pr-0.5">
                          {schAtt.events.map((ev, idx) => (
                            <div
                              key={idx}
                              className="group flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50/60 px-3 py-2.5 text-xs hover:border-zinc-200 transition"
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <span className="font-mono text-[11px] font-medium text-zinc-400 shrink-0">
                                  {ev.start_time} - {ev.end_time}
                                </span>
                                <div className="min-w-0 truncate">
                                  <span className="font-semibold text-zinc-800 truncate block">
                                    {ev.title}
                                  </span>
                                  {ev.location && (
                                    <span className="text-[10px] text-zinc-400 flex items-center gap-1 truncate pt-0.5">
                                      <MapPin className="h-2.5 w-2.5 shrink-0" />
                                      <span>{ev.location}</span>
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* 各予定の時間・場所の天気 */}
                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                {(() => {
                                  const hour = parseInt(ev.start_time.split(":")[0], 10) || 12;
                                  const isNight = hour < 6 || hour >= 18;
                                  const weatherInfo = ev.weather || {
                                    temp_c: hour <= 10 ? 14.0 : hour <= 16 ? 17.5 : 12.0,
                                    rain_probability: 0.1,
                                    icon_type: (isNight ? "moon" : "sun") as "sun" | "moon" | "cloud" | "rain",
                                  };

                                  return (
                                    <div className="flex items-center gap-1.5 rounded-lg bg-white border border-zinc-200/60 px-2 py-1 text-[11px] text-zinc-600 shadow-2xs">
                                      {weatherInfo.icon_type === "rain" ? (
                                        <CloudRain className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                                      ) : weatherInfo.icon_type === "moon" ? (
                                        <Moon className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                                      ) : weatherInfo.icon_type === "cloud" ? (
                                        <Cloud className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                                      ) : (
                                        <Sun className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                      )}
                                      <span className="font-bold text-zinc-800">{weatherInfo.temp_c}℃</span>
                                      {weatherInfo.rain_probability >= 0.2 && (
                                        <span
                                          className={
                                            weatherInfo.rain_probability >= 0.4
                                              ? "text-sky-600 font-semibold text-[10px]"
                                              : "text-zinc-400 text-[10px]"
                                          }
                                        >
                                          {Math.round(weatherInfo.rain_probability * 100)}%
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()}

                                {onDeleteEvent && (
                                  <button
                                    onClick={() => onDeleteEvent(idx)}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-rose-600 transition shrink-0"
                                    title="予定を削除"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* インライン予定追加フォーム */}
                      {isAddingEvent && (
                        <form onSubmit={handleAddSubmit} className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 space-y-2.5 text-xs animate-in fade-in duration-150">
                          <div className="flex items-center gap-2">
                            <input
                              type="time"
                              value={newEvent.start_time}
                              onChange={(e) => setNewEvent({ ...newEvent, start_time: e.target.value })}
                              className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs"
                            />
                            <span className="text-zinc-400">〜</span>
                            <input
                              type="time"
                              value={newEvent.end_time}
                              onChange={(e) => setNewEvent({ ...newEvent, end_time: e.target.value })}
                              className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs"
                            />
                          </div>
                          <input
                            type="text"
                            placeholder="予定名（例: 渋谷オフィス出社、夜食事会）"
                            value={newEvent.title}
                            onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                            className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:border-zinc-900"
                          />
                          <input
                            type="text"
                            placeholder="場所（任意: 渋谷ヒカリエ、恵比寿など）"
                            value={newEvent.location}
                            onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                            className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:border-zinc-900"
                          />
                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setIsAddingEvent(false)}
                              className="px-2.5 py-1 text-[11px] text-zinc-500 hover:text-zinc-800"
                            >
                              キャンセル
                            </button>
                            <button
                              type="submit"
                              disabled={!newEvent.title.trim()}
                              className="rounded-lg bg-zinc-900 text-white px-3 py-1 text-[11px] font-bold hover:bg-zinc-800 disabled:opacity-40"
                            >
                              追加して反映
                            </button>
                          </div>
                        </form>
                      )}

                      {/* 下段: アクションボタン */}
                      <div className="flex items-center justify-between pt-2 border-t border-zinc-100 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setIsAddingEvent(!isAddingEvent)}
                          className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 px-2.5 py-1 font-medium text-zinc-700 transition"
                        >
                          <Plus className="h-3.5 w-3.5 text-zinc-500" />
                          <span>予定を追加</span>
                        </button>

                        <div className="flex items-center gap-1.5">
                          {schAtt.gcalStatus === "disconnected" ? (
                            <>
                              {onConnectGoogleCalendar && (
                                <button
                                  type="button"
                                  onClick={() => onConnectGoogleCalendar(false)}
                                  disabled={isGCalLoading}
                                  className="rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 px-2.5 py-1 font-medium text-zinc-700 transition disabled:opacity-40"
                                >
                                  {isGCalLoading ? "同期中..." : "Google連携"}
                                </button>
                              )}
                              {onConnectGoogleCalendar && (
                                <button
                                  type="button"
                                  onClick={() => onConnectGoogleCalendar(true)}
                                  disabled={isGCalLoading}
                                  className="rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white px-2.5 py-1 font-medium transition disabled:opacity-40"
                                >
                                  デモ同期
                                </button>
                              )}
                            </>
                          ) : (
                            onDisconnectGoogleCalendar && (
                              <button
                                type="button"
                                onClick={onDisconnectGoogleCalendar}
                                className="rounded-lg border border-zinc-200 hover:bg-zinc-50 text-zinc-500 px-2.5 py-1 font-medium transition"
                              >
                                連携解除
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* 1-D. クローゼット（手持ち服一覧）カード */}
                {msg.attachment.type === "wardrobe_view" && (
                  <WardrobeCard
                    wardrobe={wardrobe}
                    initialCategory={msg.attachment.initialCategory}
                    onToggleLaundry={onToggleLaundry}
                    onItemDetail={onItemDetail}
                    onTriggerPhotoUpload={onTriggerPhotoUpload}
                    onAddManualItem={onAddManualItem}
                    onResetToDemo={onResetToDemo}
                  />
                )}

                {/* 2. コーデ提案カード群 (ChatGPT/Apple風 ミニマルカルーセル表示) */}
                {msg.attachment.type === "outfits" && (
                  <div className="space-y-2.5 w-full">
                    {/* 天気・場所インジケーター（レコメンド対象の環境） */}
                    {msg.attachment.weather && (
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-zinc-200/80 text-[11px] text-zinc-700 shadow-2xs">
                        <MapPin className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                        <span className="font-bold text-zinc-900">{msg.attachment.weather.location_name}</span>
                        {msg.attachment.destinationLocation && (
                          <span className="text-zinc-500 font-medium">（行先: {msg.attachment.destinationLocation}）</span>
                        )}
                        <span className="text-zinc-300">•</span>
                        <span className="font-medium text-zinc-800">{msg.attachment.weather.condition_label}</span>
                        <span className="font-mono text-zinc-500">
                          {msg.attachment.weather.afternoon_temp_c}℃ / {msg.attachment.weather.evening_temp_c}℃
                        </span>
                        <span className="text-zinc-400">降水 {Math.round(msg.attachment.weather.rain_probability * 100)}%</span>
                      </div>
                    )}

                    {/* 横スクロール & スナップコンテナ */}
                    <div className="flex gap-3.5 overflow-x-auto snap-x snap-mandatory pb-3 pt-1 px-0.5 scrollbar-none -mx-1">
                      {msg.attachment.outfits.map((outfit) => {
                        const isChosen = selectedOutfitRank === outfit.rank;
                        const isExpanded = !!expandedOutfitRanks[outfit.rank];

                        return (
                          <div
                            key={outfit.rank}
                            className={`flex flex-col justify-between rounded-2xl border bg-white p-4 transition-all duration-200 shrink-0 snap-center sm:snap-start w-[85vw] max-w-[310px] sm:w-[300px] ${
                              isChosen
                                ? "border-zinc-900 ring-2 ring-zinc-900/10 shadow-sm"
                                : "border-zinc-200/80 hover:border-zinc-300 shadow-xs"
                            }`}
                          >
                            <div className="space-y-3">
                              {/* 1. カードヘッダー */}
                              <div>
                                <div className="flex items-center justify-between text-[10px]">
                                  <span className="font-bold text-zinc-400 tracking-wider uppercase">
                                    Option 0{outfit.rank}
                                  </span>
                                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-mono font-semibold text-zinc-700">
                                    {outfit.total_clo} Clo
                                  </span>
                                </div>
                                <h4 className="text-sm sm:text-base font-bold text-zinc-900 mt-1 leading-snug">
                                  {outfit.title}
                                </h4>

                                {/* 特徴バッジ */}
                                {(outfit.revived_dormant_ids.length > 0 || outfit.umbrella_type !== "none") && (
                                  <div className="flex flex-wrap items-center gap-1.5 pt-1.5 text-[10px]">
                                    {outfit.revived_dormant_ids.length > 0 && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200/60 px-2 py-0.5 font-medium text-amber-800">
                                        <Flame className="h-3 w-3 text-amber-600 shrink-0" />
                                        <span>眠っていた服を活用</span>
                                      </span>
                                    )}
                                    {outfit.umbrella_type === "umbrella" && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 border border-sky-200/60 px-2 py-0.5 font-medium text-sky-800">
                                        <Umbrella className="h-3 w-3 text-sky-600 shrink-0" />
                                        <span>長傘を推奨</span>
                                      </span>
                                    )}
                                    {outfit.umbrella_type === "folding" && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 border border-sky-200/60 px-2 py-0.5 font-medium text-sky-800">
                                        <Umbrella className="h-3 w-3 text-sky-600 shrink-0" />
                                        <span>折りたたみ傘</span>
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* 2. 2x2 アイテムコラージュ（洗練されたクリーンカード） */}
                              <div className="grid grid-cols-2 gap-1.5">
                                {outfit.items.map((item) => (
                                  <div
                                    key={item.id}
                                    onClick={() => onItemDetail(item)}
                                    className="group relative flex flex-col overflow-hidden rounded-xl border border-zinc-100 bg-zinc-50/60 cursor-pointer hover:border-zinc-300 hover:shadow-2xs transition"
                                  >
                                    <div className="relative aspect-4/3 w-full bg-zinc-100 overflow-hidden">
                                      {item.image_url ? (
                                        <img
                                          src={item.image_url}
                                          alt={item.name}
                                          className="h-full w-full object-cover group-hover:scale-105 transition duration-200"
                                          loading="lazy"
                                        />
                                      ) : (
                                        <div className="flex h-full w-full items-center justify-center text-zinc-300">
                                          <Shirt className="h-5 w-5" />
                                        </div>
                                      )}
                                      <span className="absolute top-1 left-1 rounded-md bg-white/90 backdrop-blur-xs px-1.5 py-0.5 text-[8px] font-bold text-zinc-700 shadow-2xs">
                                        {CATEGORY_LABELS[item.category]}
                                      </span>
                                    </div>

                                    <div className="p-1.5 flex items-center justify-between gap-1">
                                      <p className="text-[10px] font-medium text-zinc-800 truncate flex-1">
                                        {item.name}
                                      </p>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onOpenSwap(outfit.rank, item.category, outfit.item_ids);
                                        }}
                                        title="入替"
                                        className="rounded-md p-1 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200/70 transition shrink-0"
                                      >
                                        <ArrowLeftRight className="h-3 w-3" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* 3. 提案理由 & 科学的スコア（アコーディオン） */}
                              <div className="pt-0.5">
                                <button
                                  type="button"
                                  onClick={() => toggleOutfitReason(outfit.rank)}
                                  className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-zinc-50 hover:bg-zinc-100/80 py-1.5 text-[11px] font-medium text-zinc-600 transition"
                                >
                                  <span>{isExpanded ? "詳細を閉じる" : "提案理由と適合スコア"}</span>
                                  {isExpanded ? (
                                    <ChevronUp className="h-3.5 w-3.5 text-zinc-400" />
                                  ) : (
                                    <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
                                  )}
                                </button>

                                {/* トグル開閉される詳細説明 */}
                                {isExpanded && (
                                  <div className="mt-2 rounded-xl bg-zinc-50 border border-zinc-100/80 p-2.5 text-[11px] leading-relaxed text-zinc-600 space-y-2 animate-in fade-in duration-150">
                                    {/* 適合スコア */}
                                    <div className="grid grid-cols-3 gap-1.5 text-center font-mono text-[9px] pb-1 border-b border-zinc-200/50">
                                      <div>
                                        <div className="text-zinc-400 text-[8px]">熱的適合</div>
                                        <div className="font-bold text-zinc-800 text-xs">{Math.round(outfit.score_breakdown.physics_clo_fit * 100)}%</div>
                                      </div>
                                      <div>
                                        <div className="text-zinc-400 text-[8px]">色彩調和</div>
                                        <div className="font-bold text-zinc-800 text-xs">{Math.round((outfit.score_breakdown.color_harmony_score ?? 0.92) * 100)}%</div>
                                      </div>
                                      <div>
                                        <div className="text-zinc-400 text-[8px]">TPO適合</div>
                                        <div className="font-bold text-zinc-800 text-xs">{Math.round(outfit.score_breakdown.tpo_formality_fit * 100)}%</div>
                                      </div>
                                    </div>

                                    <p className="font-medium text-zinc-800">{outfit.reason}</p>
                                    {outfit.weather_advice && (
                                      <p className="text-zinc-500 pt-0.5">
                                        {outfit.weather_advice}
                                      </p>
                                    )}
                                    {outfit.umbrella_advice && (
                                      <div className="flex items-start gap-1 text-zinc-700 pt-0.5">
                                        <Umbrella className="h-3.5 w-3.5 text-sky-600 shrink-0 mt-0.5" />
                                        <span>{outfit.umbrella_advice}</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* 4. アクションボタン（決定 & 体感キャリブレーション） */}
                            <div className="mt-3 pt-2.5 border-t border-zinc-100">
                              <button
                                onClick={() => onWearOutfit(outfit)}
                                disabled={isCalendarSaving}
                                className={`w-full rounded-xl py-2 text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs ${
                                  isChosen
                                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                    : "bg-zinc-900 text-white hover:bg-zinc-800"
                                }`}
                              >
                                {isCalendarSaving && selectedOutfitRank === outfit.rank ? (
                                  <>
                                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                    <span>カレンダーに記録中...</span>
                                  </>
                                ) : isChosen ? (
                                  <>
                                    <Check className="h-3.5 w-3.5" />
                                    <span>{gcalStatus !== "disconnected" ? "カレンダー記録済" : "今日のコーデに決定"}</span>
                                  </>
                                ) : (
                                  <>
                                    <CalendarPlus className="h-3.5 w-3.5" />
                                    <span>今日これを着る</span>
                                  </>
                                )}
                              </button>

                              {/* 着用後 体感キャリブレーション（数理オフセット補正） */}
                              {isChosen && onComfortFeedback && (
                                <div className="mt-2.5 pt-2 border-t border-zinc-100 space-y-1.5 animate-in fade-in duration-150">
                                  <div className="flex items-center justify-between text-[10px]">
                                    <span className="font-semibold text-zinc-600 flex items-center gap-1">
                                      <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                                      <span>着用後の体感フィードバック</span>
                                    </span>
                                    {feedbackSubmittedRank === outfit.rank && (
                                      <span className="text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.2 rounded text-[9px]">
                                        補正済 ✓
                                      </span>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-3 gap-1">
                                    <button
                                      type="button"
                                      onClick={() => onComfortFeedback("cold", outfit)}
                                      className="rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 py-1.5 px-1 text-center transition flex flex-col items-center justify-center gap-0.5 cursor-pointer active:scale-95"
                                      title="寒かったため次回から暖かめ（+0.08 Clo）に自動補正します"
                                    >
                                      <span className="text-[10px] font-bold text-zinc-800">寒かった</span>
                                      <span className="text-[8px] text-zinc-400 font-mono">+0.08 Clo</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onComfortFeedback("optimal", outfit)}
                                      className="rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 py-1.5 px-1 text-center transition flex flex-col items-center justify-center gap-0.5 cursor-pointer active:scale-95"
                                      title="適正だったため現在の設定を維持します"
                                    >
                                      <span className="text-[10px] font-bold text-zinc-800">適正</span>
                                      <span className="text-[8px] text-zinc-400 font-mono">±0.00 Clo</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onComfortFeedback("warm", outfit)}
                                      className="rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 py-1.5 px-1 text-center transition flex flex-col items-center justify-center gap-0.5 cursor-pointer active:scale-95"
                                      title="暑かったため次回から軽快（-0.08 Clo）に自動補正します"
                                    >
                                      <span className="text-[10px] font-bold text-zinc-800">暑かった</span>
                                      <span className="text-[8px] text-zinc-400 font-mono">-0.08 Clo</span>
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. 手持ち服登録ドラフトカード */}
                {msg.attachment.type === "clothing_draft" && (
                  <DraftClothingCard
                    draft={msg.attachment.draft}
                    imageUrl={msg.attachment.imageUrl}
                    onConfirm={onConfirmAddClothing}
                  />
                )}

                {/* 4. アイテム部分入れ替え (Swap) 候補カード */}
                {msg.attachment.type === "swap_candidates" && (() => {
                  const swapAttachment = msg.attachment;
                  return (
                    <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between border-b border-zinc-100 pb-1.5">
                        <span className="text-xs font-bold text-zinc-900">
                          {CATEGORY_LABELS[swapAttachment.targetCategory]} の差し替え候補
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          Option 0{swapAttachment.outfitRank} を更新
                        </span>
                      </div>

                      <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                        {swapAttachment.candidates.map((cand) => (
                          <div
                            key={cand.item.id}
                            className={`flex items-center justify-between p-2 rounded-xl border transition ${
                              cand.is_currently_selected
                                ? "border-zinc-900 bg-zinc-50"
                                : cand.is_physically_safe
                                ? "border-zinc-200 bg-white hover:border-zinc-400"
                                : "border-zinc-100 opacity-50"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="h-8 w-8 rounded-lg overflow-hidden bg-zinc-100 shrink-0 border border-zinc-200">
                                {cand.item.image_url ? (
                                  <img src={cand.item.image_url} alt={cand.item.name} className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-zinc-300">
                                    <Shirt className="h-4 w-4" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-[11px] font-semibold text-zinc-900 truncate">{cand.item.name}</p>
                                <div className="flex items-center gap-1.5 text-[9px] text-zinc-400">
                                  <span>{cand.item.clo_value} Clo</span>
                                  {cand.is_revival && (
                                    <span className="text-amber-600 font-medium">眠っていた服</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="shrink-0 ml-1.5">
                              {cand.is_currently_selected ? (
                                <span className="text-[10px] font-medium text-zinc-400">選択中</span>
                              ) : (
                                <button
                                  onClick={() => onApplySwap(cand.item, swapAttachment.outfitRank)}
                                  className="rounded-lg bg-zinc-900 text-white px-2 py-0.8 text-[10px] font-medium hover:bg-zinc-800 transition"
                                >
                                  変更
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* 5. 検索結果カード */}
                {msg.attachment.type === "search_results" && (
                  <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-1.5">
                      <span className="text-xs font-bold text-zinc-900">
                        「{msg.attachment.query}」の候補
                      </span>
                      <button
                        onClick={onOpenClosetDrawer}
                        className="text-[10px] font-medium text-zinc-500 hover:text-zinc-900"
                      >
                        全一覧を開く
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {msg.attachment.results.slice(0, 3).map((res) => (
                        <div
                          key={res.item.id}
                          onClick={() => onItemDetail(res.item)}
                          className="rounded-xl border border-zinc-200/80 p-2 cursor-pointer hover:border-zinc-400 transition"
                        >
                          <div className="relative aspect-4/3 w-full rounded-lg overflow-hidden bg-zinc-100 mb-1">
                            {res.item.image_url ? (
                              <img src={res.item.image_url} alt={res.item.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-zinc-300">
                                <Shirt className="h-5 w-5" />
                              </div>
                            )}
                            <span className="absolute top-1 right-1 rounded bg-black/60 px-1 py-0.2 text-[8px] font-bold text-white">
                              {res.match_percentage}%
                            </span>
                          </div>
                          <p className="text-[10px] font-bold text-zinc-900 truncate">{res.item.name}</p>
                          <p className="text-[9px] text-zinc-400">{res.item.clo_value} Clo</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 6. Google カレンダー記録完了カード ＆ 体感フィードバックボタン */}
                {msg.attachment.type === "calendar_saved" && (() => {
                  const calAtt = msg.attachment;
                  const targetOutfit =
                    calAtt.outfit ||
                    messages
                      .flatMap((m) => (m.attachment?.type === "outfits" ? m.attachment.outfits : []))
                      .find((o) => o.rank === selectedOutfitRank) ||
                    messages
                      .flatMap((m) => (m.attachment?.type === "outfits" ? m.attachment.outfits : []))[0];

                  const isSubmitted = Boolean(
                    targetOutfit && feedbackSubmittedRank === targetOutfit.rank
                  );

                  return (
                    <div className="rounded-2xl border border-zinc-200/90 bg-white p-3.5 text-zinc-900 shadow-xs space-y-3">
                      {/* 上段: カレンダー記録状態 */}
                      <div className="flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 shrink-0">
                            <Calendar className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-zinc-900 truncate">{calAtt.title}</p>
                            <p className="text-[11px] text-zinc-500">
                              {calAtt.htmlLink ? "Google カレンダー自動同期完了" : "カレンダー追加リンク発行済"}
                            </p>
                          </div>
                        </div>
                        {calAtt.htmlLink && (
                          <a
                            href={calAtt.htmlLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-800 px-2.5 py-1 text-[11px] font-medium shrink-0 transition"
                          >
                            <span>予定を開く</span>
                            <ExternalLink className="h-3 w-3 text-zinc-400" />
                          </a>
                        )}
                        {calAtt.templateUrl && (
                          <a
                            href={calAtt.templateUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white px-3 py-1.5 text-xs font-bold shrink-0 transition shadow-xs"
                          >
                            <CalendarPlus className="h-3.5 w-3.5" />
                            <span>カレンダーに追加</span>
                            <ExternalLink className="h-3 w-3 text-zinc-300" />
                          </a>
                        )}
                      </div>

                      {/* Google未連携時のカレンダー連携案内 */}
                      {calAtt.templateUrl && (
                        <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-2.5 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Calendar className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                              <span className="text-xs font-semibold text-zinc-800">
                                Google カレンダー連携
                              </span>
                            </div>
                            {onConnectGoogleCalendar && (
                              <button
                                type="button"
                                onClick={() => onConnectGoogleCalendar()}
                                disabled={isGCalLoading}
                                className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-800 px-2.5 py-1 text-[11px] font-semibold shrink-0 transition shadow-2xs disabled:opacity-50"
                              >
                                {isGCalLoading ? (
                                  <RefreshCw className="h-3 w-3 animate-spin text-zinc-400" />
                                ) : (
                                  <ExternalLink className="h-3 w-3 text-zinc-400" />
                                )}
                                <span>連携する</span>
                              </button>
                            )}
                          </div>
                          <p className="text-[10px] text-zinc-500 leading-relaxed">
                            ※ 連携すると次回から服を選ぶだけで、自動でGoogleカレンダーに予定が登録されます
                          </p>
                        </div>
                      )}

                      {/* 中段: 確定した日の天気と場所 */}
                      {calAtt.weather && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-50 border border-zinc-100 text-[10px] text-zinc-600">
                          <MapPin className="h-3 w-3 text-zinc-500 shrink-0" />
                          <span className="font-semibold text-zinc-900">{calAtt.weather.location_name}</span>
                          {calAtt.destinationLocation && (
                            <span className="text-zinc-500 truncate">（行先: {calAtt.destinationLocation}）</span>
                          )}
                          <span className="text-zinc-300">|</span>
                          <span className="text-zinc-800">{calAtt.weather.condition_label}</span>
                          <span className="font-mono text-zinc-700">最高 {calAtt.weather.afternoon_temp_c}℃ / 朝晩 {calAtt.weather.evening_temp_c}℃</span>
                          <span className="text-zinc-400">降水 {Math.round(calAtt.weather.rain_probability * 100)}%</span>
                        </div>
                      )}

                      {/* 下段: 体感キャリブレーション（数理オフセット補正コンソール） */}
                      {onComfortFeedback && targetOutfit && (
                        <div className="pt-2.5 border-t border-zinc-100 space-y-2">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-zinc-700 flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                              <span>実着用後の体感補正（目標Cloのキャリブレーション）</span>
                            </span>
                            {isSubmitted && (
                              <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded text-[10px]">
                                補正完了 ✓
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <button
                              type="button"
                              onClick={() => onComfortFeedback("cold", targetOutfit)}
                              className="rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 hover:border-zinc-300 py-2 px-2 text-xs font-semibold text-zinc-800 transition flex flex-col items-center justify-center gap-0.5 cursor-pointer active:scale-95"
                            >
                              <span className="font-bold">寒かった</span>
                              <span className="text-[10px] text-zinc-400 font-mono">+0.08 Clo</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onComfortFeedback("optimal", targetOutfit)}
                              className="rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 hover:border-zinc-300 py-2 px-2 text-xs font-semibold text-zinc-800 transition flex flex-col items-center justify-center gap-0.5 cursor-pointer active:scale-95"
                            >
                              <span className="font-bold">適正</span>
                              <span className="text-[10px] text-zinc-400 font-mono">±0.00 Clo</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onComfortFeedback("warm", targetOutfit)}
                              className="rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 hover:border-zinc-300 py-2 px-2 text-xs font-semibold text-zinc-800 transition flex flex-col items-center justify-center gap-0.5 cursor-pointer active:scale-95"
                            >
                              <span className="font-bold">暑かった</span>
                              <span className="text-[10px] text-zinc-400 font-mono">-0.08 Clo</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        );
      })}

      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-zinc-400 p-2">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          <span>推論中...</span>
        </div>
      )}
    </div>
  );
}

const SUBTYPE_PRESETS: Record<ClothingCategory, Array<{ label: string; subtype: string; clo: number; formality: number }>> = {
  top: [
    { label: "ニット", subtype: "knit", clo: 0.34, formality: 3 },
    { label: "シャツ", subtype: "shirt", clo: 0.25, formality: 4 },
    { label: "Tシャツ", subtype: "t-shirt", clo: 0.09, formality: 2 },
    { label: "パーカー", subtype: "sweatshirt", clo: 0.34, formality: 2 },
  ],
  bottom: [
    { label: "スラックス", subtype: "slacks", clo: 0.24, formality: 4 },
    { label: "デニム", subtype: "denim", clo: 0.26, formality: 2 },
    { label: "チノパン", subtype: "chino", clo: 0.23, formality: 3 },
  ],
  outer: [
    { label: "コート", subtype: "coat", clo: 0.55, formality: 4 },
    { label: "ジャケット", subtype: "jacket", clo: 0.45, formality: 4 },
    { label: "カーディガン", subtype: "cardigan", clo: 0.28, formality: 3 },
    { label: "ダウン", subtype: "down", clo: 0.75, formality: 3 },
  ],
  shoes: [
    { label: "ローファー", subtype: "loafer", clo: 0.05, formality: 4 },
    { label: "スニーカー", subtype: "sneaker", clo: 0.04, formality: 2 },
    { label: "ブーツ", subtype: "boots", clo: 0.06, formality: 4 },
  ],
};

/**
 * 手持ち服登録ドラフトカード（色彩抽出 & 1タップ属性連動版）
 */
function DraftClothingCard({
  draft: initialDraft,
  imageUrl,
  onConfirm,
}: {
  draft: AnalyzeClothingResponse;
  imageUrl?: string | null;
  onConfirm: (draft: AnalyzeClothingResponse, imageUrl?: string | null) => void;
}) {
  const [draft, setDraft] = useState<AnalyzeClothingResponse>(initialDraft);
  const [isSaved, setIsSaved] = useState(false);

  const handleCategoryChange = (newCat: ClothingCategory) => {
    const defaultPreset = SUBTYPE_PRESETS[newCat][0];
    const primaryColor = draft.colors[0] || "";
    setDraft({
      ...draft,
      category: newCat,
      subtype: defaultPreset.subtype,
      clo_value: defaultPreset.clo,
      formality: defaultPreset.formality,
      suggested_name: `${primaryColor ? primaryColor + "の" : ""}${defaultPreset.label}`,
    });
  };

  const handleSubtypeSelect = (preset: { label: string; subtype: string; clo: number; formality: number }) => {
    const primaryColor = draft.colors[0] || "";
    setDraft({
      ...draft,
      subtype: preset.subtype,
      clo_value: preset.clo,
      formality: preset.formality,
      suggested_name: `${primaryColor ? primaryColor + "の" : ""}${preset.label}`,
    });
  };

  const handleSave = () => {
    setIsSaved(true);
    onConfirm(draft, imageUrl);
  };

  const isNonAiExtraction = draft.analysis_source.includes("pillow") || draft.analysis_source.includes("deterministic");

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-2xs space-y-2.5">
      <div className="flex items-center justify-between border-b border-zinc-100 pb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-zinc-900">
            服の解析結果プレビュー
          </span>
          {isNonAiExtraction && (
            <span className="rounded bg-emerald-50 text-emerald-800 border border-emerald-200/60 px-1.5 py-0.2 text-[8px] font-bold">
              非AI色抽出
            </span>
          )}
        </div>
        <span className="text-[10px] text-zinc-500 font-mono font-bold bg-zinc-100 px-1.5 py-0.5 rounded">
          {draft.clo_value} Clo / Lv.{draft.formality}
        </span>
      </div>

      <div className="flex flex-col sm:flex-row gap-2.5 items-start">
        <div className="h-16 w-16 rounded-xl overflow-hidden bg-zinc-50 border border-zinc-200 shrink-0 flex items-center justify-center">
          {imageUrl ? (
            <img src={imageUrl} alt="プレビュー" className="h-full w-full object-cover" />
          ) : (
            <Shirt className="h-6 w-6 text-zinc-400" />
          )}
        </div>

        <div className="space-y-2 text-xs flex-1 w-full">
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <label className="text-[9px] text-zinc-400 block mb-0.5">アイテム名</label>
              <input
                type="text"
                value={draft.suggested_name}
                onChange={(e) => setDraft({ ...draft, suggested_name: e.target.value })}
                className="w-full rounded-lg border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[9px] text-zinc-400 block mb-0.5">大カテゴリ</label>
              <select
                value={draft.category}
                onChange={(e) => handleCategoryChange(e.target.value as ClothingCategory)}
                className="w-full rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-900 focus:outline-none bg-white cursor-pointer"
              >
                <option value="top">トップス</option>
                <option value="bottom">ボトムス</option>
                <option value="outer">アウター</option>
                <option value="shoes">シューズ</option>
              </select>
            </div>
          </div>

          {/* 1タップ サブタイプ選択チップ（Clo値・フォーマル度連動） */}
          <div>
            <label className="text-[9px] text-zinc-400 block mb-1">
              種類（タップでClo値・フォーマル度を自動同期）
            </label>
            <div className="flex flex-wrap gap-1">
              {SUBTYPE_PRESETS[draft.category].map((preset) => {
                const isSelected = draft.subtype === preset.subtype;
                return (
                  <button
                    key={preset.subtype}
                    type="button"
                    onClick={() => handleSubtypeSelect(preset)}
                    className={`rounded-lg px-2 py-0.8 text-[10px] font-medium transition cursor-pointer ${
                      isSelected
                        ? "bg-zinc-900 text-white shadow-2xs"
                        : "bg-zinc-100 hover:bg-zinc-200 text-zinc-700"
                    }`}
                  >
                    {preset.label} ({preset.clo} Clo)
                  </button>
                );
              })}
            </div>
          </div>

          {/* 抽出色バッジ & 撥水トグル */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-zinc-100 text-[10px]">
            <div className="flex items-center gap-1.5 text-zinc-600">
              <span className="text-[9px] text-zinc-400">検出色:</span>
              <span className="font-semibold text-zinc-900">
                {draft.colors.join("・") || "ブラック"}
              </span>
            </div>

            <label className="flex items-center gap-1 text-zinc-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={draft.water_resistant}
                onChange={(e) => setDraft({ ...draft, water_resistant: e.target.checked })}
                className="rounded border-zinc-300 text-zinc-900 focus:ring-0"
              />
              <Droplets className="h-3 w-3 text-blue-500" />
              <span>雨・撥水対応</span>
            </label>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-1">
        <button
          onClick={handleSave}
          disabled={isSaved}
          className="rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white px-3.5 py-1.5 text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer"
        >
          <Check className="h-3 w-3" />
          <span>{isSaved ? "登録完了" : "クローゼットに登録"}</span>
        </button>
      </div>
    </div>
  );
}

// ==========================================
// インライン・クローゼットカードコンポーネント
// ==========================================

const WARDROBE_DEFAULT_CLO: Record<ClothingCategory, number> = {
  top: 0.25,
  bottom: 0.24,
  outer: 0.50,
  shoes: 0.05,
};

interface WardrobeCardProps {
  wardrobe: ClothingItem[];
  initialCategory?: ClothingCategory | "all";
  onToggleLaundry?: (itemId: string) => void;
  onItemDetail: (item: ClothingItem) => void;
  onTriggerPhotoUpload?: () => void;
  onAddManualItem?: (item: ClothingItem) => void;
  onResetToDemo?: () => void;
}

function WardrobeCard({
  wardrobe,
  initialCategory = "all",
  onToggleLaundry,
  onItemDetail,
  onTriggerPhotoUpload,
  onAddManualItem,
  onResetToDemo,
}: WardrobeCardProps) {
  const [selectedCategory, setSelectedCategory] = useState<"all" | ClothingCategory>(initialCategory);
  const [filterDormantOnly, setFilterDormantOnly] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);

  // 手動入力ステート
  const [manualName, setManualName] = useState("");
  const [manualCategory, setManualCategory] = useState<ClothingCategory>("top");
  const [manualColor, setManualColor] = useState("ブラック");
  const [manualClo, setManualClo] = useState(0.25);
  const [manualFormality, setManualFormality] = useState(3);

  const dormantCount = wardrobe.filter((i) => i.days_since_last_worn >= 30).length;
  const utilizationRate =
    wardrobe.length === 0 ? 0 : Math.round(((wardrobe.length - dormantCount) / wardrobe.length) * 100);

  const filteredItems = wardrobe.filter((item) => {
    if (selectedCategory !== "all" && item.category !== selectedCategory) return false;
    if (filterDormantOnly && item.days_since_last_worn < 30) return false;
    return true;
  });

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim() || !onAddManualItem) return;

    const newItem: ClothingItem = {
      id: `item_${Date.now()}`,
      name: manualName.trim(),
      category: manualCategory,
      subtype: manualCategory,
      colors: [manualColor],
      formality: manualFormality,
      clo_value: manualClo,
      water_resistant: false,
      wear_count: 0,
      days_since_last_worn: 30, // 登録直後は死蔵ブースト対象
      availability: "available",
      image_url: null,
      style_tags: ["my-item", "casual"],
    };

    onAddManualItem(newItem);
    setManualName("");
    setIsManualOpen(false);
  };

  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 sm:p-5 space-y-3.5 shadow-xs w-full max-w-lg">
      {/* 上段: クローゼット概要 & 操作ボタン */}
      <div className="flex items-center justify-between gap-2 border-b border-zinc-100 pb-3">
        <div>
          <div className="flex items-center gap-1.5">
            <Shirt className="h-4 w-4 text-zinc-700" />
            <span className="font-bold text-sm text-zinc-900">手持ちクローゼット</span>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
              全{wardrobe.length}着
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            稼働率 {utilizationRate}% • 眠り {dormantCount}着（30日以上未着用）
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onTriggerPhotoUpload && (
            <button
              type="button"
              onClick={onTriggerPhotoUpload}
              className="flex items-center gap-1 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white px-3 py-1 text-[11px] font-bold transition shadow-2xs cursor-pointer"
              title="写真を撮影・アップロードして解析登録"
            >
              <Camera className="h-3 w-3" />
              <span>写真で追加</span>
            </button>
          )}
          {onAddManualItem && (
            <button
              type="button"
              onClick={() => setIsManualOpen(!isManualOpen)}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer border ${
                isManualOpen
                  ? "bg-zinc-100 text-zinc-900 border-zinc-300"
                  : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
              }`}
              title="文字入力で服を追加"
            >
              <Plus className="h-3 w-3" />
              <span>手動</span>
            </button>
          )}
          {onResetToDemo && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm("初期のデモ服データにリセットしますか？現在の登録内容は消去されます。")) {
                  onResetToDemo();
                }
              }}
              className="rounded-full p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition cursor-pointer border border-transparent hover:border-zinc-200"
              title="初期デモ服に戻す"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 手動追加フォーム（開いている時） */}
      {isManualOpen && (
        <form onSubmit={handleManualSubmit} className="rounded-xl bg-zinc-50/80 border border-zinc-200/80 p-3 space-y-2.5 text-xs">
          <div className="flex items-center justify-between pb-1 border-b border-zinc-200/60">
            <span className="font-bold text-zinc-800 text-[11px]">服を手動で登録</span>
            <button
              type="button"
              onClick={() => setIsManualOpen(false)}
              className="text-zinc-400 hover:text-zinc-600 text-xs"
            >
              閉じる
            </button>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-zinc-600 mb-0.5">服の名前</label>
            <input
              type="text"
              required
              placeholder="例: 白オックスフォードシャツ"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs focus:border-zinc-900 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-zinc-600 mb-0.5">カテゴリ</label>
            <div className="grid grid-cols-4 gap-1">
              {(["top", "bottom", "outer", "shoes"] as const).map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => {
                    setManualCategory(cat);
                    setManualClo(WARDROBE_DEFAULT_CLO[cat]);
                  }}
                  className={`rounded-md py-1 text-center text-[10px] font-semibold transition border ${
                    manualCategory === cat
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100"
                  }`}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-zinc-600 mb-0.5">メインカラー</label>
              <input
                type="text"
                placeholder="例: ネイビー"
                value={manualColor}
                onChange={(e) => setManualColor(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs focus:border-zinc-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-zinc-600 mb-0.5">フォーマル度</label>
              <select
                value={manualFormality}
                onChange={(e) => setManualFormality(Number(e.target.value))}
                className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs focus:border-zinc-900 focus:outline-none"
              >
                <option value={1}>Lv.1 部屋着</option>
                <option value={2}>Lv.2 休日カジュアル</option>
                <option value={3}>Lv.3 スマート</option>
                <option value={4}>Lv.4 オフィス</option>
                <option value={5}>Lv.5 スーツ</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[10px] font-semibold text-zinc-600 mb-0.5">
              <span>断熱性 (Clo値)</span>
              <span className="font-mono text-zinc-900">{manualClo.toFixed(2)} Clo</span>
            </div>
            <input
              type="range"
              min="0.05"
              max="1.0"
              step="0.05"
              value={manualClo}
              onChange={(e) => setManualClo(parseFloat(e.target.value))}
              className="w-full accent-zinc-900 h-1.5"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-zinc-900 py-1.5 text-xs font-bold text-white hover:bg-zinc-800 transition cursor-pointer"
          >
            クローゼットに追加
          </button>
        </form>
      )}

      {/* 中段: カテゴリタブ & 死蔵フィルター（洗練ピルデザイン） */}
      <div className="flex items-center justify-between gap-1 text-xs">
        <div className="flex gap-1 overflow-x-auto scrollbar-none py-0.5">
          {(["all", "top", "bottom", "outer", "shoes"] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition shrink-0 cursor-pointer ${
                selectedCategory === cat
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200/70"
              }`}
            >
              {cat === "all" ? "すべて" : CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setFilterDormantOnly(!filterDormantOnly)}
          className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition shrink-0 cursor-pointer border ${
            filterDormantOnly
              ? "bg-amber-500 text-white border-amber-500"
              : "bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100"
          }`}
          title="30日以上着ていない服のみ表示"
        >
          <Sparkles className="h-3 w-3 text-amber-600" />
          <span>眠り</span>
        </button>
      </div>

      {/* 下段: 服グリッド（洗練されたギャラリーカード） */}
      {filteredItems.length === 0 ? (
        <div className="rounded-xl bg-zinc-50 border border-zinc-100 py-8 text-center text-zinc-400 space-y-1">
          <Shirt className="h-6 w-6 mx-auto text-zinc-300" />
          <p className="text-xs font-medium">該当する服がありません</p>
          <p className="text-[10px] text-zinc-400">「写真で追加」または「手動」から服を登録できます</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto pr-0.5">
          {filteredItems.map((item) => {
            const isDormant = item.days_since_last_worn >= 30;
            const isLaundry = item.availability === "laundry";

            return (
              <div
                key={item.id}
                onClick={() => onItemDetail(item)}
                className={`group rounded-xl border bg-white overflow-hidden transition shadow-2xs cursor-pointer relative ${
                  isLaundry
                    ? "opacity-50 border-zinc-200"
                    : isDormant
                    ? "border-amber-300 ring-1 ring-amber-300/40"
                    : "border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <div className="relative aspect-4/3 w-full bg-zinc-100 overflow-hidden">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="h-full w-full object-cover group-hover:scale-105 transition duration-200"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-zinc-300">
                      <Shirt className="h-7 w-7" />
                    </div>
                  )}
                  <span className="absolute top-1.5 left-1.5 rounded-md bg-white/90 backdrop-blur-xs px-1.5 py-0.5 text-[8px] font-bold text-zinc-700 shadow-2xs">
                    {CATEGORY_LABELS[item.category]}
                  </span>
                  {isDormant && (
                    <span className="absolute top-1.5 right-1.5 rounded-md bg-amber-500/95 backdrop-blur-xs px-1.5 py-0.5 text-[8px] font-bold text-white shadow-2xs">
                      {item.days_since_last_worn}日眠り
                    </span>
                  )}
                </div>

                <div className="p-2 space-y-1">
                  <p className="text-[11px] font-bold text-zinc-900 truncate leading-tight">{item.name}</p>
                  <div className="flex items-center justify-between text-[9px] text-zinc-500">
                    <span>{item.colors[0] || "標準"}</span>
                    <span className="font-mono font-semibold">{item.clo_value} Clo</span>
                  </div>

                  <div className="pt-1 border-t border-zinc-100 flex items-center justify-between text-[9px]">
                    <span className="text-zinc-400">着用{item.wear_count}回</span>
                    {onToggleLaundry && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleLaundry(item.id);
                        }}
                        className={`rounded px-1.5 py-0.5 text-[9px] font-bold transition cursor-pointer ${
                          isLaundry
                            ? "bg-amber-600 text-white"
                            : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                        }`}
                      >
                        {isLaundry ? "洗濯中" : "着られる"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
  Cpu,
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
}: ChatMessageListProps) {
  // コーデごとに「理由を知る」を開閉するトグル状態（outfitRank単位）
  const [expandedOutfitRanks, setExpandedOutfitRanks] = useState<Record<number, boolean>>({});
  // 推論トレースの開閉トグル（メッセージID単位）
  const [expandedTraceIds, setExpandedTraceIds] = useState<Record<string, boolean>>({});

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
                {/* 1. 朝のブリーフィングカード（すっきりコンパクト） */}
                {msg.attachment.type === "briefing" && (
                  <div className="rounded-2xl border border-zinc-200/70 bg-white p-3 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        {msg.attachment.weather.rain_probability >= 0.5 ? (
                          <CloudRain className="h-3.5 w-3.5 text-blue-500" />
                        ) : (
                          <Sun className="h-3.5 w-3.5 text-amber-500" />
                        )}
                        <span className="font-bold text-zinc-800 text-[11px] sm:text-xs">
                          {msg.attachment.weather.location_name} • {msg.attachment.weather.condition_label}
                        </span>
                      </div>
                      <button
                        onClick={onOpenLocationModal}
                        className="text-[11px] font-medium text-zinc-500 hover:text-zinc-900 transition"
                      >
                        変更
                      </button>
                    </div>

                    <div className="flex items-center justify-between rounded-xl bg-zinc-50 px-2.5 py-1.5 text-[11px] text-zinc-600">
                      <span>朝 {msg.attachment.weather.morning_temp_c}℃</span>
                      <span className="text-zinc-300">•</span>
                      <span className="font-semibold text-zinc-900">昼 {msg.attachment.weather.afternoon_temp_c}℃</span>
                      <span className="text-zinc-300">•</span>
                      <span>夜 {msg.attachment.weather.evening_temp_c}℃</span>
                      <span className="text-zinc-300">•</span>
                      <span>降水 {Math.round(msg.attachment.weather.rain_probability * 100)}%</span>
                    </div>
                  </div>
                )}

                {/* 1-B. 場所・気象設定カード（ミニマルで上質なチャットインラインUI） */}
                {msg.attachment.type === "location_settings" && (() => {
                  const locAtt = msg.attachment;
                  const isHome = Boolean(
                    locAtt.homeLocation && locAtt.weather.location_name.includes(locAtt.homeLocation)
                  );
                  return (
                    <div className="rounded-2xl border border-zinc-200/80 bg-white p-3.5 space-y-2.5 shadow-2xs">
                      {/* 上段: 地域・現在の気温・天候 */}
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <MapPin className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                          <span className="font-bold text-zinc-900 truncate">
                            {locAtt.weather.location_name}
                          </span>
                          <span className="text-zinc-400">•</span>
                          <span className="text-zinc-600 truncate">{locAtt.weather.condition_label}</span>
                        </div>
                        <div className="flex items-baseline gap-0.5 shrink-0 pl-2">
                          <span className="text-base font-bold text-zinc-900">
                            {locAtt.weather.afternoon_temp_c}
                          </span>
                          <span className="text-[11px] text-zinc-500">℃</span>
                        </div>
                      </div>

                      {/* 中段: 1日の推移 & 傘の目安（すっきりテキストバー） */}
                      <div className="rounded-xl bg-zinc-50 px-3 py-2 text-[11px] text-zinc-600 space-y-1">
                        <div className="flex items-center justify-between">
                          <span>朝 {locAtt.weather.morning_temp_c}℃</span>
                          <span className="text-zinc-300">•</span>
                          <span className="font-semibold text-zinc-900">昼 {locAtt.weather.afternoon_temp_c}℃</span>
                          <span className="text-zinc-300">•</span>
                          <span>夜 {locAtt.weather.evening_temp_c}℃</span>
                          <span className="text-zinc-300">•</span>
                          <span>降水 {Math.round(locAtt.weather.rain_probability * 100)}%</span>
                        </div>

                        {/* 傘の助言 */}
                        <div className="flex items-center gap-1.5 pt-1 border-t border-zinc-200/60 text-zinc-700">
                          <Umbrella className="h-3 w-3 text-zinc-500 shrink-0" />
                          <span className="truncate">
                            {locAtt.umbrellaType === "umbrella"
                              ? "しっかりした長傘とお足元の対策が安心"
                              : locAtt.umbrellaType === "folding"
                              ? "折りたたみ傘があると安心"
                              : "傘は不要です"}
                            {locAtt.destinationLocation && `（行く場所: ${locAtt.destinationLocation}）`}
                          </span>
                        </div>
                      </div>

                      {/* 下段: アクション（現在地 / 居住区 / 主要都市） */}
                      <div className="pt-0.5 space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          {/* 現在地 & 居住区クイックボタン */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {onGetLocation && (
                              <button
                                onClick={onGetLocation}
                                className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-100 px-2 py-1 font-medium text-zinc-700 transition"
                              >
                                <LocateFixed className="h-3 w-3 text-zinc-500" />
                                <span>現在地</span>
                              </button>
                            )}

                            {locAtt.homeLocation && !isHome && onSelectCity && (
                              <button
                                onClick={() => onSelectCity(locAtt.homeLocation!)}
                                className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-100 px-2 py-1 font-medium text-zinc-700 transition"
                              >
                                <Home className="h-3 w-3 text-zinc-500" />
                                <span>居住区（{locAtt.homeLocation}）</span>
                              </button>
                            )}

                            {onSetHomeLocation && (
                              <button
                                onClick={() => onSetHomeLocation(locAtt.weather.location_name)}
                                disabled={isHome}
                                className={`rounded-lg px-2 py-1 font-medium transition ${
                                  isHome
                                    ? "text-zinc-400 cursor-default"
                                    : "border border-zinc-200 hover:border-zinc-400 text-zinc-600 hover:bg-zinc-100"
                                }`}
                              >
                                {isHome ? "✓ 居住区" : "ここを居住区に"}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* 主要都市クイックタグ */}
                        {onSelectCity && (
                          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none text-[11px]">
                            {["渋谷", "横浜", "梅田", "烏丸", "名古屋", "天神", "札幌", "仙台"].map((city) => (
                              <button
                                key={city}
                                onClick={() => onSelectCity(city)}
                                className="shrink-0 rounded-lg px-2 py-0.8 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition"
                              >
                                {city}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* 1-C. 予定・スケジュール設定カード（ミニマルで上質なチャットインラインUI） */}
                {msg.attachment.type === "schedule_settings" && (() => {
                  const schAtt = msg.attachment;
                  return (
                    <div className="rounded-2xl border border-zinc-200/80 bg-white p-3.5 space-y-3 shadow-2xs">
                      {/* 上段: 予定件数 & 同期状態 */}
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 text-zinc-500" />
                          <span className="font-bold text-zinc-900">
                            本日の予定（{schAtt.events.length}件）
                          </span>
                        </div>
                        {schAtt.gcalStatus !== "disconnected" && (
                          <span className="flex items-center gap-1 text-[11px] font-medium text-zinc-500">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            <span>カレンダー同期中</span>
                          </span>
                        )}
                      </div>

                      {/* 中段: 予定リスト */}
                      {schAtt.events.length === 0 ? (
                        <div className="rounded-xl bg-zinc-50 p-4 text-center text-[11px] text-zinc-400">
                          本日の予定はありません。「予定を追加」またはGoogleカレンダーから同期できます。
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-60 overflow-y-auto">
                          {schAtt.events.map((ev, idx) => (
                            <div
                              key={idx}
                              className="group flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2 text-xs transition"
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <span className="font-mono text-[11px] text-zinc-400 shrink-0">
                                  {ev.start_time} - {ev.end_time}
                                </span>
                                <div className="min-w-0 truncate">
                                  <span className="font-medium text-zinc-800 truncate block">
                                    {ev.title}
                                  </span>
                                  {ev.location && (
                                    <span className="text-[10px] text-zinc-400 flex items-center gap-1 truncate">
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
                                    <div className="flex items-center gap-1 rounded-lg bg-white border border-zinc-200/60 px-2 py-0.5 text-[11px] text-zinc-600 shadow-2xs">
                                      {weatherInfo.icon_type === "rain" ? (
                                        <CloudRain className="h-3 w-3 text-blue-500 shrink-0" />
                                      ) : weatherInfo.icon_type === "moon" ? (
                                        <Moon className="h-3 w-3 text-indigo-400 shrink-0" />
                                      ) : weatherInfo.icon_type === "cloud" ? (
                                        <Cloud className="h-3 w-3 text-zinc-400 shrink-0" />
                                      ) : (
                                        <Sun className="h-3 w-3 text-amber-500 shrink-0" />
                                      )}
                                      <span className="font-bold text-zinc-800">{weatherInfo.temp_c}℃</span>
                                      {weatherInfo.rain_probability >= 0.2 && (
                                        <span
                                          className={
                                            weatherInfo.rain_probability >= 0.4
                                              ? "text-blue-600 font-semibold text-[10px]"
                                              : "text-zinc-400 text-[10px]"
                                          }
                                        >
                                          • {Math.round(weatherInfo.rain_probability * 100)}%
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()}

                                {onDeleteEvent && (
                                  <button
                                    onClick={() => onDeleteEvent(idx)}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-red-600 transition shrink-0"
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
                        <form onSubmit={handleAddSubmit} className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 space-y-2 text-xs animate-in fade-in duration-150">
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
                          <div className="flex justify-end gap-1.5 pt-1">
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
                      <div className="flex items-center justify-between pt-1 border-t border-zinc-100 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setIsAddingEvent(!isAddingEvent)}
                          className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-100 px-2.5 py-1 font-medium text-zinc-700 transition"
                        >
                          <Plus className="h-3 w-3 text-zinc-500" />
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
                                  className="rounded-lg border border-zinc-200 bg-white hover:bg-zinc-100 px-2.5 py-1 font-medium text-zinc-700 transition disabled:opacity-40"
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
                                className="rounded-lg border border-zinc-200 hover:bg-zinc-100 text-zinc-500 px-2 py-1 font-medium transition"
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

                {/* 2. コーデ提案カード群 (横スライド・コンパクトカルーセル表示) */}
                {msg.attachment.type === "outfits" && (
                  <div className="space-y-1">
                    {/* 横スクロール & スナップコンテナ */}
                    <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 pt-0.5 px-0.5 scrollbar-none -mx-1">
                      {msg.attachment.outfits.map((outfit) => {
                        const isChosen = selectedOutfitRank === outfit.rank;
                        const isExpanded = !!expandedOutfitRanks[outfit.rank];

                        return (
                          <div
                            key={outfit.rank}
                            className={`flex flex-col justify-between rounded-2xl border bg-white p-3 transition-all duration-200 shrink-0 snap-center sm:snap-start w-[82vw] max-w-[290px] sm:w-[280px] ${
                              isChosen
                                ? "border-zinc-900 ring-2 ring-zinc-900/10 shadow-sm"
                                : "border-zinc-200/70 hover:border-zinc-300 shadow-2xs"
                            }`}
                          >
                            <div className="space-y-2">
                              {/* カードヘッダー */}
                              <div className="flex items-start justify-between gap-1">
                                <div>
                                  <span className="text-[9px] font-semibold text-zinc-400">
                                    Option 0{outfit.rank}
                                  </span>
                                  <h4 className="text-xs sm:text-sm font-bold text-zinc-900 leading-tight">
                                    {outfit.title}
                                  </h4>
                                </div>
                                <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[9px] font-mono font-medium text-zinc-600">
                                  {outfit.total_clo} Clo
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                                {outfit.revived_dormant_ids.length > 0 && (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-1.5 py-0.5 font-medium text-zinc-700">
                                    <Flame className="h-2.5 w-2.5 text-zinc-500 shrink-0" />
                                    <span>眠っていた服</span>
                                  </span>
                                )}
                                {outfit.umbrella_type === "umbrella" && (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-1.5 py-0.5 font-medium text-zinc-700">
                                    <Umbrella className="h-2.5 w-2.5 text-zinc-500 shrink-0" />
                                    <span>長傘</span>
                                  </span>
                                )}
                                {outfit.umbrella_type === "folding" && (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-1.5 py-0.5 font-medium text-zinc-700">
                                    <Umbrella className="h-2.5 w-2.5 text-zinc-500 shrink-0" />
                                    <span>折りたたみ傘</span>
                                  </span>
                                )}
                              </div>

                              {/* 2x2 実写コラージュ（コンパクト＆スタイリッシュ） */}
                              <div className="grid grid-cols-2 gap-1">
                                {outfit.items.map((item) => (
                                  <div
                                    key={item.id}
                                    onClick={() => onItemDetail(item)}
                                    className="group relative flex flex-col overflow-hidden rounded-lg border border-zinc-100 bg-zinc-50 cursor-pointer hover:border-zinc-300 transition"
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
                                          <Shirt className="h-4 w-4" />
                                        </div>
                                      )}
                                      <span className="absolute top-0.5 left-0.5 rounded bg-black/60 px-1 py-0.2 text-[7px] font-bold text-white uppercase">
                                        {CATEGORY_LABELS[item.category]}
                                      </span>
                                    </div>

                                    <div className="p-1 flex items-center justify-between gap-0.5">
                                      <p className="text-[9px] font-medium text-zinc-800 truncate flex-1">
                                        {item.name}
                                      </p>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onOpenSwap(outfit.rank, item.category, outfit.item_ids);
                                        }}
                                        title="入替"
                                        className="rounded p-0.5 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200 transition shrink-0"
                                      >
                                        <ArrowLeftRight className="h-2.5 w-2.5" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* 数理スコア内訳（被服気候学 × 色彩調和 × TPO） */}
                              <div className="grid grid-cols-3 gap-1 py-1 px-1.5 rounded-lg bg-zinc-50 border border-zinc-100 text-[8px] text-zinc-500 font-mono">
                                <div title="被服気候学熱的適合度">
                                  熱適合 <span className="font-bold text-zinc-800">{Math.round(outfit.score_breakdown.physics_clo_fit * 100)}%</span>
                                </div>
                                <div title="ファッション色彩調和スコア">
                                  色彩調和 <span className="font-bold text-zinc-800">{Math.round((outfit.score_breakdown.color_harmony_score ?? 0.92) * 100)}%</span>
                                </div>
                                <div title="予定要求フォーマル度合致">
                                  TPO適合 <span className="font-bold text-zinc-800">{Math.round(outfit.score_breakdown.tpo_formality_fit * 100)}%</span>
                                </div>
                              </div>

                              {/* 「この服の理由を知る」トグルボタン */}
                              <div className="pt-0.5">
                                <button
                                  type="button"
                                  onClick={() => toggleOutfitReason(outfit.rank)}
                                  className="w-full flex items-center justify-center gap-1 rounded-lg bg-zinc-50 hover:bg-zinc-100 py-1 text-[10px] font-medium text-zinc-600 transition"
                                >
                                  <span>{isExpanded ? "理由を閉じる" : "この服の理由を知る"}</span>
                                  {isExpanded ? (
                                    <ChevronUp className="h-3 w-3 text-zinc-400" />
                                  ) : (
                                    <ChevronDown className="h-3 w-3 text-zinc-400" />
                                  )}
                                </button>

                                {/* トグル開閉される詳細説明 */}
                                {isExpanded && (
                                  <div className="mt-1.5 rounded-xl bg-zinc-50 p-2 text-[10px] leading-relaxed text-zinc-600 space-y-1 animate-in fade-in duration-150">
                                    <p className="font-medium text-zinc-800">{outfit.reason}</p>
                                    {outfit.weather_advice && (
                                      <p className="text-zinc-500 border-t border-zinc-200/60 pt-1">
                                        {outfit.weather_advice}
                                      </p>
                                    )}
                                    {outfit.umbrella_advice && (
                                      <div className="flex items-start gap-1 text-zinc-700 border-t border-zinc-200/60 pt-1">
                                        <Umbrella className="h-3 w-3 text-indigo-600 shrink-0 mt-0.5" />
                                        <span>{outfit.umbrella_advice}</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* 決定ボタン */}
                            <div className="mt-2.5 pt-2 border-t border-zinc-100">
                              <button
                                onClick={() => onWearOutfit(outfit)}
                                disabled={isCalendarSaving}
                                className={`w-full rounded-xl py-1.5 text-xs font-bold transition flex items-center justify-center gap-1 ${
                                  isChosen
                                    ? "bg-emerald-600 text-white shadow-xs"
                                    : "bg-zinc-900 text-white hover:bg-zinc-800"
                                }`}
                              >
                                {isCalendarSaving && selectedOutfitRank === outfit.rank ? (
                                  <>
                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                    <span>記録中...</span>
                                  </>
                                ) : isChosen ? (
                                  <>
                                    <Check className="h-3 w-3" />
                                    <span>カレンダー記録済</span>
                                  </>
                                ) : (
                                  <>
                                    <CalendarPlus className="h-3 w-3" />
                                    <span>今日これを着る</span>
                                  </>
                                )}
                              </button>

                              {/* 着用後 1タップ体感フィードバック（次回のClo目標レンジ自己補正） */}
                              {isChosen && onComfortFeedback && (
                                <div className="mt-2 pt-2 border-t border-zinc-100/90 space-y-1.5 animate-in fade-in duration-150">
                                  <div className="flex items-center justify-between text-[9px] text-zinc-500">
                                    <span className="font-semibold text-zinc-700">着た後の体感は？（次回自動補正）</span>
                                    {feedbackSubmittedRank === outfit.rank && (
                                      <span className="text-emerald-600 font-bold">学習完了 ✓</span>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-3 gap-1">
                                    <button
                                      type="button"
                                      onClick={() => onComfortFeedback("cold", outfit)}
                                      className="rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200/60 py-1 text-[9px] font-bold transition flex items-center justify-center gap-0.5 cursor-pointer shadow-2xs"
                                      title="寒かったため次回から暖かめ（+0.08 Clo）に自動補正します"
                                    >
                                      <span>🥶 寒かった</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onComfortFeedback("optimal", outfit)}
                                      className="rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200/60 py-1 text-[9px] font-bold transition flex items-center justify-center gap-0.5 cursor-pointer shadow-2xs"
                                      title="ちょうどよかったため現在の断熱設定を維持します"
                                    >
                                      <span>😊 快適</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onComfortFeedback("warm", outfit)}
                                      className="rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/60 py-1 text-[9px] font-bold transition flex items-center justify-center gap-0.5 cursor-pointer shadow-2xs"
                                      title="暑かったため次回から軽快（-0.08 Clo）に自動補正します"
                                    >
                                      <span>🥵 暑かった</span>
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Own the Why: 決定論的数理推論トレース */}
                    {msg.attachment.trace && (() => {
                      const trace = msg.attachment.trace;
                      const isTraceOpen = !!expandedTraceIds[msg.id];
                      const isZeroTokens = trace.inference_engine.includes("0 tokens") || !trace.inference_engine.includes("vertex");

                      return (
                        <div className="mt-1 rounded-2xl border border-zinc-200/80 bg-white/95 p-2.5 shadow-2xs">
                          <div className="flex items-center justify-between text-[11px]">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold ${
                                  isZeroTokens
                                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200/60"
                                    : "bg-indigo-50 text-indigo-800 border border-indigo-200/60"
                                }`}
                              >
                                <Cpu className="h-2.5 w-2.5" />
                                <span>{isZeroTokens ? "⚡ 0 Tokens / 数理最適化エンジン" : "Vertex AI Gemini"}</span>
                              </span>
                              {trace.personal_clo_offset !== undefined && trace.personal_clo_offset !== 0.0 && (
                                <span className="inline-flex items-center gap-1 rounded bg-amber-50 border border-amber-200/60 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">
                                  体感学習補正: {trace.personal_clo_offset > 0 ? `+${trace.personal_clo_offset}` : trace.personal_clo_offset} Clo
                                </span>
                              )}
                              <span className="text-[10px] text-zinc-400 font-mono">
                                {trace.latency_ms}ms
                              </span>
                            </div>
                            <button
                              onClick={() => setExpandedTraceIds((prev) => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                              className="flex items-center gap-1 text-[10px] font-medium text-zinc-500 hover:text-zinc-900 transition cursor-pointer"
                            >
                              <span>{isTraceOpen ? "推論詳細を閉じる" : "Own the Why 推論トレース"}</span>
                              {isTraceOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            </button>
                          </div>

                          {isTraceOpen && (
                            <div className="mt-2 pt-2 border-t border-zinc-100 text-[10px] text-zinc-600 space-y-1.5 animate-in fade-in duration-150">
                              <div className="flex items-start gap-1.5">
                                <span className="font-bold text-zinc-800 shrink-0">Stage 1 (被服気候学):</span>
                                <span>
                                  全 {trace.total_combinations_explored} 通りの手持ち服から、予定時間帯と移動先気象に基づく目標断熱性（{trace.target_clo_min}〜{trace.target_clo_max} Clo・METs {trace.average_mets}
                                  {trace.personal_clo_offset ? `・個人体感補正 ${trace.personal_clo_offset > 0 ? '+' : ''}${trace.personal_clo_offset} Clo 適用済` : ''}）を満たす <strong className="text-zinc-900">{trace.stage1_physics_passed} 通り</strong> を決定論的フィルタリング。
                                </span>
                              </div>
                              <div className="flex items-start gap-1.5">
                                <span className="font-bold text-zinc-800 shrink-0">Stage 2 (色彩調和 &amp; 死蔵衣類):</span>
                                <span>
                                  配色理論（モノトーン/ベースカラー調和）× 上下フォーマル度格差ペナルティ × 30日以上未着用の死蔵服ブーストで数理スコアリング。
                                </span>
                              </div>
                              <div className="flex items-start gap-1.5">
                                <span className="font-bold text-zinc-800 shrink-0">Stage 3 (多基準リランキング):</span>
                                <span>
                                  今日の予定（フォーマル度 Lv.{trace.required_formality}）と寒暖差に合わせた納得の理由をミリ秒生成。
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
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
                    <div className="rounded-2xl border border-zinc-200/90 bg-white p-3 text-zinc-900 shadow-2xs space-y-3">
                      {/* 上段: カレンダー記録状態 */}
                      <div className="flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
                            <Calendar className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold text-zinc-900 truncate">{calAtt.title}</p>
                            <p className="text-[10px] text-zinc-500">Googleカレンダーに記録しました</p>
                          </div>
                        </div>
                        {calAtt.htmlLink && (
                          <a
                            href={calAtt.htmlLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg bg-zinc-900 text-white px-2.5 py-1 text-[10px] font-medium shrink-0 hover:bg-zinc-800 transition"
                          >
                            <span>確認</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {calAtt.templateUrl && (
                          <a
                            href={calAtt.templateUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg bg-zinc-900 text-white px-2.5 py-1 text-[10px] font-medium shrink-0 hover:bg-zinc-800 transition"
                          >
                            <span>追加</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>

                      {/* 下段: 体感フィードバックボタン（メッセージ本文の案内と完全連動） */}
                      {onComfortFeedback && targetOutfit && (
                        <div className="pt-2.5 border-t border-zinc-100 space-y-2">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="font-bold text-zinc-700">着た後の体感は？（次回自動学習）</span>
                            {isSubmitted && (
                              <span className="text-emerald-600 font-bold flex items-center gap-0.5">
                                <span>学習完了</span>
                                <span>✓</span>
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-1.5">
                            <button
                              type="button"
                              onClick={() => onComfortFeedback("cold", targetOutfit)}
                              className="rounded-xl bg-blue-50/90 hover:bg-blue-100 active:bg-blue-200 text-blue-900 border border-blue-200/70 py-2 px-1 text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer shadow-2xs active:scale-95"
                              title="寒かったため次回から暖かめ（+0.08 Clo）に自動補正します"
                            >
                              <span>🥶 寒かった</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onComfortFeedback("optimal", targetOutfit)}
                              className="rounded-xl bg-emerald-50/90 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-900 border border-emerald-200/70 py-2 px-1 text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer shadow-2xs active:scale-95"
                              title="ちょうどよかったため現在の断熱設定を維持します"
                            >
                              <span>😊 快適</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onComfortFeedback("warm", targetOutfit)}
                              className="rounded-xl bg-amber-50/90 hover:bg-amber-100 active:bg-amber-200 text-amber-900 border border-amber-200/70 py-2 px-1 text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer shadow-2xs active:scale-95"
                              title="暑かったため次回から軽快（-0.08 Clo）に自動補正します"
                            >
                              <span>🥵 暑かった</span>
                            </button>
                          </div>
                          <p className="text-[9px] text-zinc-400 text-center">
                            タップすると Cloud Firestore へ差分が記録され、目標断熱レンジが自動補正されます
                          </p>
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
    <div className="rounded-2xl border border-zinc-200/80 bg-white p-3.5 space-y-3 shadow-2xs">
      {/* 上段: クローゼット概要 & 操作ボタン */}
      <div className="flex items-center justify-between gap-2 border-b border-zinc-100 pb-2.5">
        <div>
          <div className="flex items-center gap-1.5">
            <Shirt className="h-4 w-4 text-zinc-700" />
            <span className="font-bold text-xs text-zinc-900">手持ちクローゼット</span>
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
              className="flex items-center gap-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white px-2.5 py-1 text-[11px] font-bold transition shadow-2xs cursor-pointer"
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
              className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition cursor-pointer border ${
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
              className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition cursor-pointer border border-transparent hover:border-zinc-200"
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

      {/* 中段: カテゴリタブ & 死蔵フィルター */}
      <div className="flex items-center justify-between gap-1 text-xs">
        <div className="flex gap-1 overflow-x-auto scrollbar-none py-0.5">
          {(["all", "top", "bottom", "outer", "shoes"] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition shrink-0 cursor-pointer ${
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
          className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition shrink-0 cursor-pointer border ${
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

      {/* 下段: 服グリッド */}
      {filteredItems.length === 0 ? (
        <div className="rounded-xl bg-zinc-50 py-8 text-center text-zinc-400 space-y-1">
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
                  <span className="absolute top-1 left-1 rounded bg-black/60 backdrop-blur-xs px-1.5 py-0.5 text-[8px] font-bold text-white uppercase">
                    {CATEGORY_LABELS[item.category]}
                  </span>
                  {isDormant && (
                    <span className="absolute top-1 right-1 rounded bg-amber-500 px-1 py-0.5 text-[8px] font-bold text-white shadow-2xs">
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

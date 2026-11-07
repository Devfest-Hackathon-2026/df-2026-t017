"use client";

import React, { useState } from "react";
import {
  ArrowLeftRight,
  Calendar,
  CalendarPlus,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  CloudRain,
  Cpu,
  ExternalLink,
  Flame,
  Info,
  MapPin,
  RefreshCw,
  Shirt,
  Sun,
  Wind,
} from "lucide-react";
import {
  AnalyzeClothingResponse,
  ClothingCategory,
  ClothingItem,
  OutfitProposal,
  PipelineTrace,
  ChatMessage,
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
  onOpenContextDrawer: () => void;
  onOpenClosetDrawer: () => void;
  selectedOutfitRank: number | null;
  isCalendarSaving: boolean;
  isLoading: boolean;
}

export function ChatMessageList({
  messages,
  onOpenSwap,
  onApplySwap,
  onWearOutfit,
  onConfirmAddClothing,
  onItemDetail,
  onOpenContextDrawer,
  onOpenClosetDrawer,
  selectedOutfitRank,
  isCalendarSaving,
  isLoading,
}: ChatMessageListProps) {
  const [openTraceId, setOpenTraceId] = useState<string | null>(null);

  return (
    <div className="flex-1 space-y-4 px-3 py-4 sm:px-4 sm:py-6 pb-36 sm:pb-40 max-w-4xl mx-auto w-full">
      {messages.map((msg) => {
        const isUser = msg.sender === "user";

        return (
          <div
            key={msg.id}
            className={`flex flex-col ${isUser ? "items-end" : "items-start"} space-y-1.5`}
          >
            {/* 送信者ラベル（AIキラキラ廃止・ミニマルなタイポグラフィ） */}
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 px-1">
              {!isUser && (
                <div className="flex h-4 w-4 items-center justify-center rounded-full bg-zinc-900 text-white text-[9px] font-bold">
                  C
                </div>
              )}
              <span className="font-medium text-zinc-600">{isUser ? "あなた" : "Closet Me"}</span>
              <span>•</span>
              <span>{msg.timestamp}</span>
            </div>

            {/* 吹き出しテキスト */}
            {msg.text && (
              <div
                className={`rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed max-w-[88%] sm:max-w-[80%] shadow-2xs ${
                  isUser
                    ? "bg-zinc-900 text-white rounded-tr-xs"
                    : "bg-white border border-zinc-200/90 text-zinc-800 rounded-tl-xs"
                }`}
              >
                {msg.imageUrl && (
                  <div className="mb-2 max-w-xs overflow-hidden rounded-xl border border-zinc-200">
                    <img src={msg.imageUrl} alt="添付画像" className="h-44 w-full object-cover" />
                  </div>
                )}
                <p className="whitespace-pre-wrap">{msg.text}</p>
              </div>
            )}

            {/* リッチカードアタッチメント */}
            {msg.attachment && (
              <div className="w-full max-w-3xl pt-1">
                {/* 1. 朝のコンテキスト・ブリーフィングカード */}
                {msg.attachment.type === "briefing" && (
                  <div className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5">
                      <div className="flex items-center gap-2">
                        {msg.attachment.weather.rain_probability >= 0.5 ? (
                          <CloudRain className="h-4 w-4 text-blue-600" />
                        ) : (
                          <Sun className="h-4 w-4 text-amber-500" />
                        )}
                        <span className="text-xs font-bold text-zinc-900">
                          {msg.attachment.weather.location_name} • {msg.attachment.weather.condition_label}
                        </span>
                      </div>
                      <button
                        onClick={onOpenContextDrawer}
                        className="rounded-lg bg-zinc-100 hover:bg-zinc-200 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 transition"
                      >
                        都市・予定を変更
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-sky-50/70 p-2 border border-sky-100">
                        <span className="text-[10px] text-zinc-500 block">朝 (08:00)</span>
                        <span className="font-bold text-sm text-sky-950">{msg.attachment.weather.morning_temp_c}℃</span>
                      </div>
                      <div className="rounded-xl bg-amber-50/70 p-2 border border-amber-100">
                        <span className="text-[10px] text-zinc-500 block">昼 (14:00)</span>
                        <span className="font-bold text-sm text-amber-950">{msg.attachment.weather.afternoon_temp_c}℃</span>
                      </div>
                      <div className="rounded-xl bg-indigo-50/70 p-2 border border-indigo-100">
                        <span className="text-[10px] text-zinc-500 block">夜 (20:00)</span>
                        <span className="font-bold text-sm text-indigo-950">{msg.attachment.weather.evening_temp_c}℃</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-zinc-600 pt-1">
                      <span className="flex items-center gap-1">
                        <Wind className="h-3 w-3" /> 風速 {msg.attachment.weather.wind_speed_ms}m/s
                      </span>
                      <span>降水確率 {Math.round(msg.attachment.weather.rain_probability * 100)}%</span>
                      {msg.attachment.trace && (
                        <span className="font-semibold text-zinc-900">
                          目標断熱性: {msg.attachment.trace.target_clo_min}〜{msg.attachment.trace.target_clo_max} Clo
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* 2. コーデ提案カード群 (横スライド・カルーセル表示) */}
                {msg.attachment.type === "outfits" && (
                  <div className="space-y-3.5">
                    {/* カルーセルガイド */}
                    <div className="flex items-center justify-between text-[11px] text-zinc-500 px-0.5">
                      <span className="font-semibold text-zinc-700">
                        提案コーディネート（全{msg.attachment.outfits.length}案）
                      </span>
                      <span className="text-[10px] text-zinc-400">
                        横にスライドして比較 ➔
                      </span>
                    </div>

                    {/* 横スクロール & スナップコンテナ */}
                    <div className="flex gap-3.5 overflow-x-auto snap-x snap-mandatory pb-2.5 pt-0.5 px-0.5 scrollbar-none -mx-1">
                      {msg.attachment.outfits.map((outfit) => {
                        const isChosen = selectedOutfitRank === outfit.rank;

                        return (
                          <div
                            key={outfit.rank}
                            className={`flex flex-col justify-between rounded-2xl border bg-white p-4 transition-all duration-200 shadow-2xs shrink-0 snap-center sm:snap-start w-[84vw] max-w-[320px] sm:w-[310px] ${
                              isChosen
                                ? "border-zinc-900 ring-2 ring-zinc-900/10 shadow-md"
                                : "border-zinc-200/90 hover:border-zinc-300 hover:shadow-xs"
                            }`}
                          >
                            <div className="space-y-3">
                              <div className="flex items-start justify-between gap-1.5">
                                <div>
                                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                    Option 0{outfit.rank}
                                  </span>
                                  <h4 className="text-sm font-bold text-zinc-900 leading-tight">
                                    {outfit.title}
                                  </h4>
                                </div>
                                <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-mono font-bold text-zinc-800">
                                  {outfit.total_clo} Clo
                                </span>
                              </div>

                              {outfit.revived_dormant_ids.length > 0 && (
                                <div className="flex items-center gap-1 rounded-lg bg-amber-50 border border-amber-200/70 px-2 py-1 text-[10px] font-bold text-amber-900">
                                  <Flame className="h-3 w-3 text-amber-600 shrink-0" />
                                  <span>眠っていた服（30日以上未着用）を復活！</span>
                                </div>
                              )}

                              {/* 2x2 実写コラージュ */}
                              <div className="grid grid-cols-2 gap-1.5">
                                {outfit.items.map((item) => {
                                  const isDormant = outfit.revived_dormant_ids.includes(item.id);
                                  return (
                                    <div
                                      key={item.id}
                                      onClick={() => onItemDetail(item)}
                                      className="group relative flex flex-col overflow-hidden rounded-xl border border-zinc-200/80 bg-zinc-50 cursor-pointer hover:border-zinc-400 transition"
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
                                            <Shirt className="h-6 w-6" />
                                          </div>
                                        )}
                                        <span className="absolute top-1 left-1 rounded bg-black/60 backdrop-blur-xs px-1 py-0.2 text-[8px] font-bold text-white uppercase">
                                          {CATEGORY_LABELS[item.category]}
                                        </span>
                                        {isDormant && (
                                          <span className="absolute top-1 right-1 rounded bg-amber-500 px-1 py-0.2 text-[8px] font-bold text-white shadow-xs">
                                            Revival
                                          </span>
                                        )}
                                      </div>

                                      <div className="p-1.5">
                                        <p className="text-[10px] font-bold text-zinc-900 truncate">
                                          {item.name}
                                        </p>
                                        <div className="flex items-center justify-between text-[9px] text-zinc-500 mt-0.5">
                                          <span>{item.colors[0]}</span>
                                          <span className="font-mono">{item.clo_value} Clo</span>
                                        </div>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onOpenSwap(outfit.rank, item.category, outfit.item_ids);
                                          }}
                                          className="mt-1 flex items-center justify-center gap-0.5 w-full rounded bg-zinc-100 hover:bg-zinc-900 hover:text-white px-1 py-0.5 text-[9px] font-bold text-zinc-700 transition"
                                        >
                                          <ArrowLeftRight className="h-2.5 w-2.5" />
                                          <span>入替</span>
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              <div className="space-y-1.5 rounded-xl bg-zinc-50 p-2.5 text-[11px] leading-relaxed text-zinc-700">
                                <p>
                                  <strong className="text-zinc-900">理由: </strong>
                                  {outfit.reason}
                                </p>
                                <p className="text-zinc-600 border-t border-zinc-200/70 pt-1 text-[10px]">
                                  <strong className="text-zinc-800">気候助言: </strong>
                                  {outfit.weather_advice}
                                </p>
                              </div>
                            </div>

                            <div className="mt-3 pt-2.5 border-t border-zinc-100">
                              <button
                                onClick={() => onWearOutfit(outfit)}
                                disabled={isCalendarSaving}
                                className={`w-full rounded-xl py-2 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                                  isChosen
                                    ? "bg-emerald-600 text-white shadow-xs"
                                    : "bg-zinc-900 text-white hover:bg-zinc-800"
                                }`}
                              >
                                {isCalendarSaving && selectedOutfitRank === outfit.rank ? (
                                  <>
                                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                    <span>カレンダーへ同期中...</span>
                                  </>
                                ) : isChosen ? (
                                  <>
                                    <Check className="h-3.5 w-3.5" />
                                    <span>✓ カレンダー記録済</span>
                                  </>
                                ) : (
                                  <>
                                    <CalendarPlus className="h-3.5 w-3.5" />
                                    <span>今日これを着る</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Own the Why 推論トレース（アコーディオン） */}
                    {msg.attachment.trace && (
                      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 text-zinc-200 p-3.5 text-xs">
                        <button
                          onClick={() =>
                            setOpenTraceId(openTraceId === msg.id ? null : msg.id)
                          }
                          className="w-full flex items-center justify-between font-bold text-emerald-400 hover:text-emerald-300 transition"
                        >
                          <div className="flex items-center gap-1.5">
                            <Cpu className="h-3.5 w-3.5" />
                            <span>Own the Why — 3段階推論トレースを見る</span>
                          </div>
                          {openTraceId === msg.id ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>

                        {openTraceId === msg.id && (
                          <div className="grid gap-2 sm:grid-cols-3 pt-3 mt-3 border-t border-zinc-800 text-[11px] leading-relaxed">
                            <div className="rounded-lg bg-zinc-900 p-2.5 border border-zinc-800">
                              <span className="text-emerald-400 font-bold block mb-1">
                                Stage 1: 被服気候学 CSP
                              </span>
                              活動量 {msg.attachment.trace.average_mets} METs と気温から目標断熱性を{" "}
                              {msg.attachment.trace.target_clo_min}〜{msg.attachment.trace.target_clo_max} Clo と決定。
                              全 {msg.attachment.trace.total_combinations_explored}通り中{" "}
                              {msg.attachment.trace.stage1_physics_passed}通りに厳格制約充足。
                            </div>
                            <div className="rounded-lg bg-zinc-900 p-2.5 border border-zinc-800">
                              <span className="text-sky-400 font-bold block mb-1">
                                Stage 2: 1408d Vector × 死蔵
                              </span>
                              Vertex AI 1408次元埋め込みで調和度を評価しつつ、30日以上未着用の服に Revival Boost を付与。
                            </div>
                            <div className="rounded-lg bg-zinc-900 p-2.5 border border-zinc-800">
                              <span className="text-amber-400 font-bold block mb-1">
                                Stage 3: Gemini リランカー
                              </span>
                              要求フォーマル度 Lv.{msg.attachment.trace.required_formality} とTPO文脈から上位3案を確定生成。
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* 3. 手持ち服登録ドラフトカード (写真・テキスト共通) */}
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
                    <div className="rounded-2xl border border-indigo-200 bg-white p-4 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                        <span className="text-xs font-bold text-zinc-900">
                          {CATEGORY_LABELS[swapAttachment.targetCategory]} の差し替え候補（被服気候学CSP判定済）
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          Option 0{swapAttachment.outfitRank} を更新
                        </span>
                      </div>

                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {swapAttachment.candidates.map((cand) => (
                          <div
                            key={cand.item.id}
                            className={`flex items-center justify-between p-2.5 rounded-xl border transition ${
                              cand.is_currently_selected
                                ? "border-zinc-900 bg-zinc-50"
                                : cand.is_physically_safe
                                ? "border-emerald-200 bg-emerald-50/20 hover:border-emerald-400"
                                : "border-zinc-200 opacity-60"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="h-10 w-10 rounded-lg overflow-hidden bg-zinc-100 shrink-0 border border-zinc-200">
                                {cand.item.image_url ? (
                                  <img src={cand.item.image_url} alt={cand.item.name} className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-zinc-300">
                                    <Shirt className="h-5 w-5" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-zinc-900 truncate">{cand.item.name}</p>
                                <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                                  <span>{cand.item.clo_value} Clo</span>
                                  <span>•</span>
                                  <span className={cand.is_physically_safe ? "text-emerald-700 font-bold" : "text-amber-700 font-bold"}>
                                    計 {cand.new_total_clo} Clo
                                  </span>
                                  {cand.is_revival && (
                                    <span className="rounded bg-amber-500 text-white px-1 py-0.2 text-[8px] font-bold">
                                      Revival
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="shrink-0 ml-2">
                              {cand.is_currently_selected ? (
                                <span className="text-[10px] font-bold text-zinc-400">選択中</span>
                              ) : (
                                <button
                                  onClick={() => onApplySwap(cand.item, swapAttachment.outfitRank)}
                                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                                    cand.is_physically_safe
                                      ? "bg-zinc-900 text-white hover:bg-zinc-800"
                                      : "bg-zinc-200 text-zinc-700"
                                  }`}
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

                {/* 5. 1408次元クロスモーダル検索結果カード */}
                {msg.attachment.type === "search_results" && (
                  <div className="rounded-2xl border border-indigo-200 bg-white p-4 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                      <span className="text-xs font-bold text-indigo-950 flex items-center gap-1">
                        <span>「{msg.attachment.query}」の類似度検索結果</span>
                      </span>
                      <button
                        onClick={onOpenClosetDrawer}
                        className="text-[10px] font-semibold text-indigo-700 hover:underline"
                      >
                        全一覧を開く
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {msg.attachment.results.slice(0, 3).map((res) => (
                        <div
                          key={res.item.id}
                          onClick={() => onItemDetail(res.item)}
                          className="rounded-xl border border-zinc-200 p-2 cursor-pointer hover:border-zinc-400 transition"
                        >
                          <div className="relative aspect-4/3 w-full rounded-lg overflow-hidden bg-zinc-100 mb-1.5">
                            {res.item.image_url ? (
                              <img src={res.item.image_url} alt={res.item.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-zinc-300">
                                <Shirt className="h-6 w-6" />
                              </div>
                            )}
                            <span className="absolute top-1 right-1 rounded bg-indigo-600 px-1 py-0.2 text-[8px] font-bold text-white">
                              {res.match_percentage}% Match
                            </span>
                          </div>
                          <p className="text-[11px] font-bold text-zinc-900 truncate">{res.item.name}</p>
                          <p className="text-[10px] text-zinc-500">{res.item.clo_value} Clo</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 6. Google カレンダー記録完了カード */}
                {msg.attachment.type === "calendar_saved" && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-emerald-950 shadow-2xs flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="rounded-xl bg-emerald-600/10 p-2 text-emerald-700 shrink-0">
                        <Calendar className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-emerald-900">{msg.attachment.title}</p>
                        <p className="text-[11px] text-emerald-700 mt-0.5">
                          本日の着用コーデをGoogleカレンダーに終日記録しました。
                        </p>
                      </div>
                    </div>
                    {msg.attachment.htmlLink && (
                      <a
                        href={msg.attachment.htmlLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-2.5 py-1 text-xs font-bold shrink-0 transition"
                      >
                        <span>確認</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {msg.attachment.templateUrl && (
                      <a
                        href={msg.attachment.templateUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-2.5 py-1 text-xs font-bold shrink-0 transition"
                      >
                        <span>追加</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-zinc-400 p-2">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          <span>スタイリストが推論中...</span>
        </div>
      )}
    </div>
  );
}

/**
 * 手持ち服登録ドラフトカード（写真・テキスト共通）
 * インラインでカテゴリやClo値、撥水性を確認・微調整してクローゼットへ追加
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

  const handleSave = () => {
    setIsSaved(true);
    onConfirm(draft, imageUrl);
  };

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-2xs space-y-3">
      <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
        <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
          <span>服の解析結果プレビュー（内容を確認して登録）</span>
        </span>
        <span className="text-[10px] text-emerald-700 font-mono">
          {draft.clo_value} Clo / Lv.{draft.formality}
        </span>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <div className="h-24 w-24 rounded-xl overflow-hidden bg-white border border-emerald-200 shrink-0 flex items-center justify-center">
          {imageUrl ? (
            <img src={imageUrl} alt="プレビュー" className="h-full w-full object-cover" />
          ) : (
            <Shirt className="h-10 w-10 text-emerald-300" />
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs flex-1 w-full">
          <div>
            <label className="text-[10px] text-zinc-400 block mb-0.5">アイテム名</label>
            <input
              type="text"
              value={draft.suggested_name}
              onChange={(e) => setDraft({ ...draft, suggested_name: e.target.value })}
              className="w-full rounded-lg border border-emerald-200 bg-white px-2 py-1 text-xs font-semibold text-zinc-900"
            />
          </div>

          <div>
            <label className="text-[10px] text-zinc-400 block mb-0.5">カテゴリ</label>
            <select
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value as ClothingCategory })}
              className="w-full rounded-lg border border-emerald-200 bg-white px-2 py-1 text-xs text-zinc-900"
            >
              <option value="top">トップス</option>
              <option value="bottom">ボトムス</option>
              <option value="outer">アウター</option>
              <option value="shoes">シューズ</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] text-zinc-400 block mb-0.5">断熱性 (Clo値)</label>
            <input
              type="number"
              step="0.01"
              value={draft.clo_value}
              onChange={(e) => setDraft({ ...draft, clo_value: parseFloat(e.target.value) || 0.2 })}
              className="w-full rounded-lg border border-emerald-200 bg-white px-2 py-1 text-xs font-mono"
            />
          </div>

          <div>
            <label className="text-[10px] text-zinc-400 block mb-0.5">撥水仕様</label>
            <button
              type="button"
              onClick={() => setDraft({ ...draft, water_resistant: !draft.water_resistant })}
              className={`w-full rounded-lg px-2 py-1 text-xs font-bold transition border ${
                draft.water_resistant
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-zinc-600 border-emerald-200"
              }`}
            >
              {draft.water_resistant ? "撥水あり (雨天対応)" : "通常 (撥水なし)"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2 border-t border-emerald-100">
        <button
          onClick={handleSave}
          disabled={isSaved}
          className="rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white px-4 py-1.5 text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
        >
          <Check className="h-3.5 w-3.5" />
          <span>{isSaved ? "登録完了" : "クローゼットに登録して再計算"}</span>
        </button>
      </div>
    </div>
  );
}

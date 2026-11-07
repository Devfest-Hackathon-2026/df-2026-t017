"use client";

import React, { useState } from "react";
import {
  ArrowLeftRight,
  Calendar,
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronUp,
  CloudRain,
  ExternalLink,
  Flame,
  RefreshCw,
  Shirt,
  Sun,
} from "lucide-react";
import {
  AnalyzeClothingResponse,
  ClothingCategory,
  ClothingItem,
  OutfitProposal,
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
  // コーデごとに「理由を知る」を開閉するトグル状態（outfitRank単位）
  const [expandedOutfitRanks, setExpandedOutfitRanks] = useState<Record<number, boolean>>({});

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
                        onClick={onOpenContextDrawer}
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

                {/* 2. コーデ提案カード群 (横スライド・コンパクトカルーセル表示) */}
                {msg.attachment.type === "outfits" && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-zinc-400 px-0.5">
                      <span>提案コーディネート（全{msg.attachment.outfits.length}案）</span>
                      <span className="text-[10px]">横にスワイプ ➔</span>
                    </div>

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

                              {outfit.revived_dormant_ids.length > 0 && (
                                <div className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.2 text-[9px] font-medium text-amber-800">
                                  <Flame className="h-2.5 w-2.5 text-amber-600 shrink-0" />
                                  <span>眠っていた服を活用</span>
                                </div>
                              )}

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
                                      <p className="text-zinc-400 border-t border-zinc-200/60 pt-1">
                                        {outfit.weather_advice}
                                      </p>
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

                {/* 6. Google カレンダー記録完了カード */}
                {msg.attachment.type === "calendar_saved" && (
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-2.5 text-zinc-900 shadow-2xs flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-emerald-600 shrink-0" />
                      <div>
                        <p className="text-[11px] font-bold text-zinc-900">{msg.attachment.title}</p>
                        <p className="text-[10px] text-zinc-500">Googleカレンダーに記録しました。</p>
                      </div>
                    </div>
                    {msg.attachment.htmlLink && (
                      <a
                        href={msg.attachment.htmlLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-zinc-900 text-white px-2 py-1 text-[10px] font-medium shrink-0 hover:bg-zinc-800 transition"
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
                        className="inline-flex items-center gap-1 rounded-lg bg-zinc-900 text-white px-2 py-1 text-[10px] font-medium shrink-0 hover:bg-zinc-800 transition"
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
          <span>推論中...</span>
        </div>
      )}
    </div>
  );
}

/**
 * 手持ち服登録ドラフトカード（すっきりミニマル版）
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
    <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-2xs space-y-2">
      <div className="flex items-center justify-between border-b border-zinc-100 pb-1">
        <span className="text-xs font-bold text-zinc-900">
          服の解析結果プレビュー
        </span>
        <span className="text-[10px] text-zinc-400 font-mono">
          {draft.clo_value} Clo
        </span>
      </div>

      <div className="flex flex-col sm:flex-row gap-2.5 items-center">
        <div className="h-16 w-16 rounded-xl overflow-hidden bg-zinc-50 border border-zinc-200 shrink-0 flex items-center justify-center">
          {imageUrl ? (
            <img src={imageUrl} alt="プレビュー" className="h-full w-full object-cover" />
          ) : (
            <Shirt className="h-6 w-6 text-zinc-400" />
          )}
        </div>

        <div className="grid grid-cols-2 gap-1.5 text-xs flex-1 w-full">
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
            <label className="text-[9px] text-zinc-400 block mb-0.5">カテゴリ</label>
            <select
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value as ClothingCategory })}
              className="w-full rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-900 focus:outline-none"
            >
              <option value="top">トップス</option>
              <option value="bottom">ボトムス</option>
              <option value="outer">アウター</option>
              <option value="shoes">シューズ</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-1">
        <button
          onClick={handleSave}
          disabled={isSaved}
          className="rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white px-3 py-1.5 text-xs font-bold transition flex items-center gap-1 shadow-xs"
        >
          <Check className="h-3 w-3" />
          <span>{isSaved ? "登録完了" : "クローゼットに登録"}</span>
        </button>
      </div>
    </div>
  );
}

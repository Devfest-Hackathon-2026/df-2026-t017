"use client";

import React, { useMemo, useState } from "react";
import {
  Compass,
  Flame,
  Plus,
  RefreshCw,
  Search,
  Shirt,
  X,
  Zap,
} from "lucide-react";
import {
  ClothingCategory,
  ClothingItem,
  CrossModalSearchResult,
} from "@/types/closet";

const CATEGORY_LABELS: Record<ClothingCategory, string> = {
  top: "トップス",
  bottom: "ボトムス",
  outer: "アウター",
  shoes: "シューズ",
};

interface ClosetDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  wardrobe: ClothingItem[];
  onToggleLaundry: (itemId: string) => void;
  onItemDetail: (item: ClothingItem) => void;
  onTriggerPhotoUpload: () => void;
  onSearchCrossModal: (query: string) => Promise<CrossModalSearchResult[]>;
}

export function ClosetDrawer({
  isOpen,
  onClose,
  wardrobe,
  onToggleLaundry,
  onItemDetail,
  onTriggerPhotoUpload,
  onSearchCrossModal,
}: ClosetDrawerProps) {
  const [selectedCategory, setSelectedCategory] = useState<"all" | ClothingCategory>("all");
  const [filterDormantOnly, setFilterDormantOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<CrossModalSearchResult[] | null>(null);

  const dormantCount = useMemo(
    () => wardrobe.filter((i) => i.days_since_last_worn >= 30).length,
    [wardrobe]
  );
  const utilizationRate = useMemo(() => {
    if (wardrobe.length === 0) return 0;
    return Math.round(((wardrobe.length - dormantCount) / wardrobe.length) * 100);
  }, [wardrobe, dormantCount]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await onSearchCrossModal(searchQuery.trim());
      setSearchResults(res);
    } finally {
      setSearching(false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setSearchResults(null);
  };

  const resultMap = useMemo(() => {
    if (!searchResults) return null;
    const map = new Map<string, CrossModalSearchResult>();
    for (const r of searchResults) map.set(r.item.id, r);
    return map;
  }, [searchResults]);

  const filteredItems = useMemo(() => {
    let list = [...wardrobe];
    if (searchResults && searchResults.length > 0) {
      const order = new Map<string, number>();
      searchResults.forEach((r, idx) => order.set(r.item.id, idx));
      list.sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999));
    }
    return list.filter((item) => {
      if (selectedCategory !== "all" && item.category !== selectedCategory) return false;
      if (filterDormantOnly && item.days_since_last_worn < 30) return false;
      return true;
    });
  }, [wardrobe, selectedCategory, filterDormantOnly, searchResults]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs transition">
      <div className="w-full max-w-xl bg-white h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3.5">
          <div>
            <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
              <span>手持ちクローゼット</span>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 font-semibold">
                全{wardrobe.length}着
              </span>
            </h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              稼働率 {utilizationRate}% • 死蔵衣類 {dormantCount}着（30日以上未着用）
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onTriggerPhotoUpload}
              className="flex items-center gap-1 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white px-3 py-1.5 text-xs font-bold transition shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>写真で追加</span>
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* 1408d ベクトル検索バー */}
        <div className="border-b border-zinc-100 bg-gradient-to-r from-indigo-50/60 to-purple-50/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-indigo-950 flex items-center gap-1">
              <Compass className="h-3.5 w-3.5 text-indigo-600" />
              <span>Vertex AI 1408d クロスモーダル検索</span>
            </span>
            {searchResults && (
              <button
                onClick={handleClearSearch}
                className="text-[10px] text-zinc-500 hover:text-zinc-800 underline"
              >
                クリア
              </button>
            )}
          </div>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
              }}
              placeholder="気分や場面で検索（例: 知的なカフェ作業、雨の日、暖かいニット）"
              className="flex-1 rounded-xl border border-indigo-200 bg-white px-3 py-1.5 text-xs focus:border-indigo-600 focus:outline-none"
            />
            <button
              onClick={handleSearch}
              disabled={searching || !searchQuery.trim()}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-3 py-1.5 text-xs font-bold transition flex items-center gap-1 shrink-0"
            >
              {searching ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                <Zap className="h-3 w-3" />
              )}
              <span>検索</span>
            </button>
          </div>
        </div>

        {/* フィルタタブ */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2 text-xs">
          <div className="flex gap-1">
            {(["all", "top", "bottom", "outer", "shoes"] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  selectedCategory === cat
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                {cat === "all" ? "すべて" : CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          <button
            onClick={() => setFilterDormantOnly(!filterDormantOnly)}
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition ${
              filterDormantOnly
                ? "bg-amber-500 text-white"
                : "bg-amber-50 text-amber-900 border border-amber-200/80 hover:bg-amber-100"
            }`}
          >
            <Flame className="h-3 w-3 text-amber-600" />
            <span>死蔵のみ</span>
          </button>
        </div>

        {/* Clothes Grid */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {filteredItems.map((item) => {
              const isDormant = item.days_since_last_worn >= 30;
              const isLaundry = item.availability === "laundry";
              const match = resultMap?.get(item.id);

              return (
                <div
                  key={item.id}
                  onClick={() => onItemDetail(item)}
                  className={`group rounded-2xl border bg-white overflow-hidden transition shadow-2xs cursor-pointer ${
                    isLaundry
                      ? "opacity-50 border-zinc-200"
                      : match && match.match_percentage >= 85
                      ? "border-indigo-400 ring-2 ring-indigo-400/20"
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
                        <Shirt className="h-8 w-8" />
                      </div>
                    )}
                    <span className="absolute top-1.5 left-1.5 rounded bg-black/60 backdrop-blur-xs px-1.5 py-0.5 text-[9px] font-bold text-white uppercase">
                      {CATEGORY_LABELS[item.category]}
                    </span>
                    {match && (
                      <span className="absolute top-1.5 right-1.5 rounded bg-indigo-600 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-xs">
                        {match.match_percentage}%
                      </span>
                    )}
                    {!match && isDormant && (
                      <span className="absolute top-1.5 right-1.5 rounded bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-xs">
                        {item.days_since_last_worn}日眠り
                      </span>
                    )}
                  </div>

                  <div className="p-2.5 space-y-1.5">
                    <p className="text-xs font-bold text-zinc-900 truncate">{item.name}</p>
                    <div className="flex items-center justify-between text-[10px] text-zinc-500">
                      <span>{item.colors[0]}</span>
                      <span className="font-mono font-semibold">{item.clo_value} Clo</span>
                    </div>

                    <div className="pt-1.5 border-t border-zinc-100 flex items-center justify-between text-[10px]">
                      <span className="text-zinc-400">着用{item.wear_count}回</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleLaundry(item.id);
                        }}
                        className={`rounded px-1.5 py-0.5 font-bold transition ${
                          isLaundry
                            ? "bg-amber-600 text-white"
                            : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                        }`}
                      >
                        {isLaundry ? "洗濯中" : "着られる"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

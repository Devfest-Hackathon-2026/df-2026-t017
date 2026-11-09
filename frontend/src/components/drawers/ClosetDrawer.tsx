"use client";

import React, { useMemo, useState } from "react";
import {
  Camera,
  Flame,
  Plus,
  RotateCcw,
  Shirt,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  ClothingCategory,
  ClothingItem,
} from "@/types/closet";

const CATEGORY_LABELS: Record<ClothingCategory, string> = {
  top: "トップス",
  bottom: "ボトムス",
  outer: "アウター",
  shoes: "シューズ",
  bag: "バッグ",
  accessory: "小物",
};

const DEFAULT_CLO: Record<ClothingCategory, number> = {
  top: 0.25,
  bottom: 0.24,
  outer: 0.50,
  shoes: 0.05,
  bag: 0,
  accessory: 0,
};

interface ClosetDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  wardrobe: ClothingItem[];
  onToggleLaundry: (itemId: string) => void;
  onItemDetail: (item: ClothingItem) => void;
  onTriggerPhotoUpload: () => void;
  onDeleteItem: (itemId: string) => void;
  onResetToDemo: () => void;
  onAddManualItem: (item: ClothingItem) => void;
  onSearchCrossModal?: (query: string) => Promise<any>;
}

export function ClosetDrawer({
  isOpen,
  onClose,
  wardrobe,
  onToggleLaundry,
  onItemDetail,
  onTriggerPhotoUpload,
  onDeleteItem,
  onResetToDemo,
  onAddManualItem,
}: ClosetDrawerProps) {
  const [selectedCategory, setSelectedCategory] = useState<"all" | ClothingCategory>("all");
  const [filterDormantOnly, setFilterDormantOnly] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

  // 手動追加フォーム状態
  const [manualName, setManualName] = useState("");
  const [manualCategory, setManualCategory] = useState<ClothingCategory>("top");
  const [manualColor, setManualColor] = useState("ブラック");
  const [manualClo, setManualClo] = useState(0.25);
  const [manualFormality, setManualFormality] = useState(3);

  const dormantCount = useMemo(
    () => wardrobe.filter((i) => i.days_since_last_worn >= 30).length,
    [wardrobe]
  );
  const utilizationRate = useMemo(() => {
    if (wardrobe.length === 0) return 0;
    return Math.round(((wardrobe.length - dormantCount) / wardrobe.length) * 100);
  }, [wardrobe, dormantCount]);

  const filteredItems = useMemo(() => {
    return wardrobe.filter((item) => {
      if (selectedCategory !== "all" && item.category !== selectedCategory) return false;
      if (filterDormantOnly && item.days_since_last_worn < 30) return false;
      return true;
    });
  }, [wardrobe, selectedCategory, filterDormantOnly]);

  const handleCreateManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim()) return;

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
    setIsManualModalOpen(false);
  };

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
              稼働率 {utilizationRate}% • 眠っている服 {dormantCount}着（30日以上未着用）
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onTriggerPhotoUpload}
              className="flex items-center gap-1 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white px-3 py-1.5 text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Camera className="h-3.5 w-3.5" />
              <span>写真で追加</span>
            </button>
            <button
              onClick={() => setIsManualModalOpen(true)}
              className="flex items-center gap-1 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer"
              title="文字入力で追加"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>手動</span>
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* フィルタタブ & リセット */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2 text-xs">
          <div className="flex gap-1 overflow-x-auto scrollbar-none">
            {(["all", "top", "bottom", "outer", "shoes"] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition shrink-0 cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                {cat === "all" ? "すべて" : CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setFilterDormantOnly(!filterDormantOnly)}
              className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition cursor-pointer ${
                filterDormantOnly
                  ? "bg-amber-500 text-white"
                  : "bg-amber-50 text-amber-900 border border-amber-200/80 hover:bg-amber-100"
              }`}
            >
              <Sparkles className="h-3 w-3 text-amber-600" />
              <span>眠り</span>
            </button>

            <button
              onClick={() => {
                if (window.confirm("初期のデモ服データにリセットしますか？現在の追加・削除内容は消去されます。")) {
                  onResetToDemo();
                }
              }}
              className="rounded-lg p-1 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition cursor-pointer"
              title="デモデータに戻す"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Clothes Grid */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-zinc-400 space-y-2">
              <Shirt className="h-10 w-10 mx-auto text-zinc-300" />
              <p className="text-sm font-medium">服が登録されていません</p>
              <p className="text-xs text-zinc-400">
                右上の「写真で追加」または「手動」からご自身の服を追加してください
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filteredItems.map((item) => {
                const isDormant = item.days_since_last_worn >= 30;
                const isLaundry = item.availability === "laundry";

                return (
                  <div
                    key={item.id}
                    onClick={() => onItemDetail(item)}
                    className={`group rounded-2xl border bg-white overflow-hidden transition shadow-2xs cursor-pointer relative ${
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
                          <Shirt className="h-8 w-8" />
                        </div>
                      )}
                      <span className="absolute top-1.5 left-1.5 rounded bg-black/60 backdrop-blur-xs px-1.5 py-0.5 text-[9px] font-bold text-white uppercase">
                        {CATEGORY_LABELS[item.category]}
                      </span>
                      {isDormant && (
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
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleLaundry(item.id);
                            }}
                            className={`rounded px-1.5 py-0.5 font-bold transition cursor-pointer ${
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
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 手動追加モーダル */}
        {isManualModalOpen && (
          <div
            onClick={() => setIsManualModalOpen(false)}
            className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b pb-2">
                <h4 className="text-sm font-bold text-zinc-900">服を手動で登録</h4>
                <button
                  onClick={() => setIsManualModalOpen(false)}
                  className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreateManual} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                    服の名前
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="例: 白オックスフォードシャツ"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-xs focus:border-zinc-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                    カテゴリ
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(["top", "bottom", "outer", "shoes", "bag", "accessory"] as const).map((cat) => (
                      <button
                        type="button"
                        key={cat}
                        onClick={() => {
                          setManualCategory(cat);
                          setManualClo(DEFAULT_CLO[cat]);
                        }}
                        className={`rounded-lg py-1.5 text-center font-semibold transition border ${
                          manualCategory === cat
                            ? "border-zinc-900 bg-zinc-900 text-white"
                            : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100"
                        }`}
                      >
                        {CATEGORY_LABELS[cat]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                      メインカラー
                    </label>
                    <input
                      type="text"
                      placeholder="例: ネイビー"
                      value={manualColor}
                      onChange={(e) => setManualColor(e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 px-3 py-1.5 text-xs focus:border-zinc-900 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                      フォーマル度 (1〜5)
                    </label>
                    <select
                      value={manualFormality}
                      onChange={(e) => setManualFormality(Number(e.target.value))}
                      className="w-full rounded-xl border border-zinc-200 px-2 py-1.5 text-xs focus:border-zinc-900 focus:outline-none bg-white"
                    >
                      <option value={1}>Lv.1 (部屋着・ラフ)</option>
                      <option value={2}>Lv.2 (休日カジュアル)</option>
                      <option value={3}>Lv.3 (スマートカジュアル)</option>
                      <option value={4}>Lv.4 (オフィスカジュアル)</option>
                      <option value={5}>Lv.5 (フォーマル・スーツ)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-semibold text-zinc-600 mb-1">
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
                    className="w-full accent-zinc-900"
                  />
                  <div className="flex justify-between text-[9px] text-zinc-400">
                    <span>薄手 (0.1)</span>
                    <span>標準 (0.3)</span>
                    <span>極暖/防寒 (0.7+)</span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-zinc-900 py-2.5 text-xs font-bold text-white hover:bg-zinc-800 transition cursor-pointer"
                  >
                    クローゼットに追加
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

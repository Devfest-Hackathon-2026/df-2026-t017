"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeftRight,
  ArrowUp,
  Briefcase,
  Calendar,
  Camera,
  Check,
  CloudSun,
  Coffee,
  Flame,
  Home,
  LocateFixed,
  MapPin,
  Plus,
  Search,
  Shirt,
  Snowflake,
  Sparkles,
  Sun,
  Thermometer,
  X,
} from "lucide-react";

export type ComposerFocusContext = "default" | "location" | "style" | "clothing" | "search";

interface ChatComposerProps {
  onSendMessage: (text: string) => void;
  onSendPhoto: (file: File) => void;
  onGetLocation?: () => void;
  onSelectChip: (chipText: string) => void;
  suggestedChips: string[];
  disabled?: boolean;
  externalOpenRequest?: {
    context: ComposerFocusContext;
    timestamp: number;
  } | null;
}

/**
 * チップ文字列から最適なLucideアイコンとアクセント種別を判定
 */
function resolveChipVisual(rawChip: string) {
  const clean = rawChip.replace(/[✨🔥👟🧥🥶📷📅📍🏡😊🥵⌨️💬]/g, "").trim();

  if (clean.includes("これを着る") || (clean.includes("登録") && clean.includes("クローゼット"))) {
    return { label: clean, Icon: Check, variant: "primary" as const };
  }
  if (clean.includes("眠っている服") || clean.includes("死蔵")) {
    return { label: clean, Icon: Flame, variant: "amber" as const };
  }
  if (clean.includes("カジュアル") || clean.includes("休日") || clean.includes("リラックス")) {
    return { label: clean, Icon: Coffee, variant: "default" as const };
  }
  if (clean.includes("きれいめ") || clean.includes("オフィス") || clean.includes("フォーマル")) {
    return { label: clean, Icon: Briefcase, variant: "default" as const };
  }
  if (
    clean.includes("靴") ||
    clean.includes("スニーカー") ||
    clean.includes("ローファー") ||
    clean.includes("アウター") ||
    clean.includes("変える")
  ) {
    return { label: clean, Icon: ArrowLeftRight, variant: "default" as const };
  }
  if (clean.includes("暖かく") || clean.includes("寒がり") || clean.includes("涼しく") || clean.includes("体感")) {
    return { label: clean, Icon: Thermometer, variant: "default" as const };
  }
  if (clean.includes("寒かった")) {
    return { label: clean, Icon: Snowflake, variant: "default" as const };
  }
  if (clean.includes("暑かった")) {
    return { label: clean, Icon: Sun, variant: "default" as const };
  }
  if (clean.includes("現在地")) {
    return { label: clean, Icon: LocateFixed, variant: "default" as const };
  }
  if (clean.includes("居住区") || clean.includes("自宅")) {
    return { label: clean, Icon: Home, variant: "default" as const };
  }
  if (
    clean.includes("天気") ||
    clean.includes("場所") ||
    clean.includes("都市") ||
    ["渋谷", "横浜", "梅田", "京都", "札幌", "福岡"].some((c) => clean.includes(c))
  ) {
    return { label: clean, Icon: MapPin, variant: "default" as const };
  }
  if (clean.includes("予定") || clean.includes("カレンダー") || clean.includes("スケジュール")) {
    return { label: clean, Icon: Calendar, variant: "default" as const };
  }
  if (clean.includes("写真")) {
    return { label: clean, Icon: Camera, variant: "default" as const };
  }
  if (clean.includes("服を追加") || clean.includes("服を登録") || clean.includes("ニット") || clean.includes("追加")) {
    return { label: clean, Icon: Plus, variant: "default" as const };
  }
  if (clean.includes("クローゼット") || clean.includes("手持ち") || clean.includes("服を確認")) {
    return { label: clean, Icon: Shirt, variant: "default" as const };
  }
  if (clean.includes("探") || clean.includes("検索")) {
    return { label: clean, Icon: Search, variant: "default" as const };
  }
  if (clean.includes("コーデ")) {
    return { label: clean, Icon: Sparkles, variant: "primary" as const };
  }

  return { label: clean, Icon: CloudSun, variant: "default" as const };
}

export function ChatComposer({
  onSendMessage,
  onSendPhoto,
  onGetLocation,
  onSelectChip,
  suggestedChips,
  disabled = false,
  externalOpenRequest,
}: ChatComposerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputText, setInputText] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 外部からの入力バー展開リクエストを処理
  useEffect(() => {
    if (externalOpenRequest) {
      setIsExpanded(true);
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 80);
    }
  }, [externalOpenRequest]);

  // 外側クリックでコンパクトに戻す（入力文字がない場合）
  useEffect(() => {
    if (!isExpanded) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (!inputText.trim()) {
          setIsExpanded(false);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isExpanded, inputText]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || disabled) return;
    onSendMessage(inputText.trim());
    setInputText("");
    setIsExpanded(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onSendPhoto(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setIsExpanded(false);
  };

  const handleChipTap = (chip: string) => {
    if (disabled) return;
    if (chip.includes("写真を選択") || chip.includes("写真から登録")) {
      fileInputRef.current?.click();
      return;
    }
    setIsExpanded(false);
    onSelectChip(chip);
  };

  const canSend = inputText.trim().length > 0 && !disabled;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 pointer-events-none pb-2.5 pt-5 sm:pb-4 sm:pt-6 bg-gradient-to-t from-[#FAF9F6] via-[#FAF9F6]/95 to-transparent">
      {/* チャット表示エリア（max-w-3xl）と横幅を完全に揃える */}
      <div className="mx-auto max-w-3xl px-3 sm:px-4 pointer-events-auto flex flex-col items-center space-y-2 w-full">
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          disabled={disabled}
        />

        {/* 1. 会話フェーズに応じた浮遊ピル群（チャットの横幅いっぱいに自然に配置） */}
        <div className="w-full flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-none px-0.5">
          {suggestedChips.map((chip, idx) => {
            const { label, Icon, variant } = resolveChipVisual(chip);
            const isFirstPrimary = idx === 0 && variant === "primary";

            return (
              <button
                key={`${chip}_${idx}`}
                type="button"
                onClick={() => handleChipTap(chip)}
                disabled={disabled}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 active:scale-95 disabled:opacity-40 cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                  isFirstPrimary
                    ? "bg-zinc-900 text-white hover:bg-zinc-800 shadow-zinc-900/10"
                    : variant === "amber"
                    ? "border border-amber-200/90 bg-amber-50/95 backdrop-blur-md text-amber-900 hover:bg-amber-100/80"
                    : "border border-zinc-200/90 bg-white/95 backdrop-blur-md text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 hover:border-zinc-300"
                }`}
              >
                <Icon
                  className={`h-3.5 w-3.5 shrink-0 ${
                    isFirstPrimary
                      ? "text-zinc-200"
                      : variant === "amber"
                      ? "text-amber-600"
                      : "text-zinc-500"
                  }`}
                />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {/* 2. モーフィング・カプセルバー（通常時は小型、タップで横幅がスッと広がるだけ） */}
        <div ref={containerRef} className="w-full flex justify-center">
          <form
            onSubmit={handleSubmit}
            onClick={() => {
              if (!isExpanded) {
                setIsExpanded(true);
                setTimeout(() => textInputRef.current?.focus(), 60);
              }
            }}
            className={`rounded-full border bg-white/95 backdrop-blur-md shadow-md shadow-zinc-900/5 transition-all duration-300 ease-out flex items-center gap-1.5 px-2 py-1.5 ${
              isExpanded
                ? "w-full border-zinc-300 shadow-lg ring-2 ring-zinc-900/5"
                : "w-64 sm:w-72 border-zinc-200/90 hover:border-zinc-300 cursor-pointer"
            }`}
          >
            {/* 写真ボタン */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              disabled={disabled}
              title="服の写真を追加"
              className="h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition active:scale-95 cursor-pointer shrink-0"
            >
              <Camera className="h-4 w-4" />
            </button>

            {/* GPSボタン（展開時のみ表示） */}
            {isExpanded && onGetLocation && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onGetLocation();
                }}
                disabled={disabled}
                title="現在地の天気に同期"
                className="h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition active:scale-95 cursor-pointer shrink-0"
              >
                <LocateFixed className="h-4 w-4" />
              </button>
            )}

            {/* 入力欄 */}
            <div className="relative flex-1 min-w-0">
              <input
                ref={textInputRef}
                type="text"
                value={inputText}
                onFocus={() => setIsExpanded(true)}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setIsExpanded(false);
                    textInputRef.current?.blur();
                  }
                }}
                placeholder={
                  isExpanded
                    ? "場所や気分、服の追加を指定（例: 横浜の天気、カジュアルな服を入れたい）..."
                    : "場所・気分・服を入力..."
                }
                disabled={disabled}
                className="w-full bg-transparent text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none px-1 cursor-text"
              />
            </div>

            {/* 閉じるボタン（展開時かつ入力が空のとき） */}
            {isExpanded && !inputText.trim() && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(false);
                }}
                className="h-6 w-6 sm:h-7 sm:w-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition shrink-0 cursor-pointer"
                title="コンパクトに戻す (Esc)"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}

            {/* 送信ボタン */}
            <button
              type="submit"
              disabled={!canSend}
              className={`h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center transition-all duration-200 shrink-0 ${
                canSend
                  ? "bg-zinc-900 text-white hover:bg-zinc-800 active:scale-95 shadow-xs cursor-pointer"
                  : "bg-zinc-100 text-zinc-300 cursor-not-allowed"
              }`}
            >
              <ArrowUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

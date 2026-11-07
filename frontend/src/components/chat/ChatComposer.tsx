"use client";

import React, { useRef, useState } from "react";
import { ArrowUp, Camera } from "lucide-react";

interface ChatComposerProps {
  onSendMessage: (text: string) => void;
  onSendPhoto: (file: File) => void;
  onSelectChip: (chipText: string) => void;
  suggestedChips: string[];
  disabled?: boolean;
}

export function ChatComposer({
  onSendMessage,
  onSendPhoto,
  onSelectChip,
  suggestedChips,
  disabled = false,
}: ChatComposerProps) {
  const [inputText, setInputText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || disabled) return;
    onSendMessage(inputText.trim());
    setInputText("");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onSendPhoto(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const canSend = inputText.trim().length > 0 && !disabled;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 pointer-events-none pb-2 pt-4 sm:pb-5 sm:pt-8 bg-gradient-to-t from-[#FAF9F6] via-[#FAF9F6]/90 to-transparent">
      <div className="mx-auto max-w-3xl px-3 sm:px-4 space-y-1.5 pointer-events-auto">
        {/* おすすめ選択肢チップバー（軽やかに浮遊するピルボタン） */}
        {suggestedChips.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none text-xs">
            {suggestedChips.map((chip, idx) => (
              <button
                key={`${chip}_${idx}`}
                onClick={() => onSelectChip(chip)}
                disabled={disabled}
                className="shrink-0 rounded-full border border-zinc-200/90 bg-white/95 backdrop-blur-md px-3 py-1 text-xs font-medium text-zinc-700 shadow-2xs hover:bg-zinc-900 hover:text-white hover:border-zinc-900 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {chip.replace(/[✨🔥👟🧥🥶📷📅]/g, "").trim()}
              </button>
            ))}
          </div>
        )}

        {/* ChatGPT風 フローティング・ピル型カプセルインプット（スマホ押しやすさ最適化） */}
        <div className="rounded-3xl border border-zinc-200/90 bg-white shadow-lg shadow-zinc-900/5 transition-all duration-200 focus-within:border-zinc-400 focus-within:shadow-xl">
          <form onSubmit={handleSubmit} className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 sm:px-3 sm:py-2">
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              disabled={disabled}
            />
            {/* 写真追加ボタン */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              title="服の写真を追加"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 transition active:scale-95 disabled:opacity-40 cursor-pointer"
            >
              <Camera className="h-4.5 w-4.5" />
            </button>

            {/* 入力エリア: text-base (16px) でiOS Safariの自動ズームを完全防止 */}
            <div className="relative flex-1 min-w-0">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="メッセージを入力..."
                disabled={disabled}
                className="w-full bg-transparent px-1 py-1.5 text-base sm:text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none disabled:text-zinc-400"
              />
            </div>

            {/* 円形上向き矢印送信ボタン */}
            <button
              type="submit"
              disabled={!canSend}
              className={`flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 ${
                canSend
                  ? "bg-zinc-900 text-white hover:bg-zinc-800 active:scale-95 shadow-2xs cursor-pointer"
                  : "bg-zinc-100 text-zinc-300 cursor-not-allowed"
              }`}
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

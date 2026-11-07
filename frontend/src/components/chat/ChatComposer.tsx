"use client";

import React, { useRef, useState } from "react";
import { Camera, Send, Sparkles } from "lucide-react";

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

  return (
    <div className="sticky bottom-0 z-20 border-t border-zinc-200 bg-white/95 backdrop-blur-md px-3 py-2.5 sm:px-4 sm:py-3 space-y-2">
      {/* おすすめ選択肢チップバー（横スクロール） */}
      {suggestedChips.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <div className="flex items-center gap-1 text-[11px] font-bold text-zinc-400 shrink-0 pr-1">
            <Sparkles className="h-3 w-3 text-amber-500" />
            <span>おすすめ:</span>
          </div>
          {suggestedChips.map((chip, idx) => (
            <button
              key={`${chip}_${idx}`}
              onClick={() => onSelectChip(chip)}
              disabled={disabled}
              className="shrink-0 rounded-full border border-zinc-200 bg-zinc-50 hover:bg-zinc-900 hover:text-white hover:border-zinc-900 px-3 py-1 text-xs font-medium text-zinc-700 transition active:scale-95 disabled:opacity-50"
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* テキスト入力 & カメラボタン */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          disabled={disabled}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          title="服の写真を送信してクローゼットに追加"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 transition active:scale-95 disabled:opacity-50"
        >
          <Camera className="h-5 w-5" />
        </button>

        <div className="relative flex-1">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="メッセージを入力（例: 黒のニット追加、靴を変えたい、雨の日用ある？）"
            disabled={disabled}
            className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs sm:text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none transition disabled:bg-zinc-100"
          />
        </div>

        <button
          type="submit"
          disabled={!inputText.trim() || disabled}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white transition hover:bg-zinc-800 disabled:opacity-40 disabled:hover:bg-zinc-900 active:scale-95"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

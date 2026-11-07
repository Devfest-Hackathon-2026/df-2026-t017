"use client";

import React, { useState } from "react";
import {
  Calendar,
  CalendarPlus,
  ChevronRight,
  Clock,
  CloudRain,
  MapPin,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sun,
  Thermometer,
  Trash2,
  X,
} from "lucide-react";
import {
  RawCalendarEvent,
  UserProfile,
  WeatherSnapshot,
} from "@/types/closet";

const POPULAR_CITIES = [
  "東京・渋谷",
  "神奈川・横浜",
  "大阪・梅田",
  "京都・烏丸",
  "愛知・名古屋",
  "福岡・天神",
  "北海道・札幌",
  "宮城・仙台",
];

interface ContextDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  weather: WeatherSnapshot | null;
  events: RawCalendarEvent[];
  profile: UserProfile;
  gcalStatus: "disconnected" | "connected_real" | "connected_demo";
  isGCalLoading: boolean;
  onSelectCity: (cityName: string) => void;
  onConnectGoogleCalendar: (forceDemo?: boolean) => void;
  onDisconnectGoogleCalendar: () => void;
  onAddEvent: (event: RawCalendarEvent) => void;
  onDeleteEvent: (index: number) => void;
  onSensitivityChange: (delta: number) => void;
}

export function ContextDrawer({
  isOpen,
  onClose,
  weather,
  events,
  profile,
  gcalStatus,
  isGCalLoading,
  onSelectCity,
  onConnectGoogleCalendar,
  onDisconnectGoogleCalendar,
  onAddEvent,
  onDeleteEvent,
  onSensitivityChange,
}: ContextDrawerProps) {
  const [customCity, setCustomCity] = useState("");
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: "",
    start_time: "14:00",
    end_time: "16:00",
    location: "",
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.title.trim()) return;
    onAddEvent({
      title: newEvent.title.trim(),
      start_time: newEvent.start_time,
      end_time: newEvent.end_time,
      location: newEvent.location.trim() || undefined,
    });
    setNewEvent({ title: "", start_time: "14:00", end_time: "16:00", location: "" });
    setIsAddingEvent(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs transition">
      <div className="w-full max-w-lg bg-white h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3.5">
          <div>
            <h3 className="text-base font-bold text-zinc-900">
              環境コンテキスト設定
            </h3>
            <p className="text-[11px] text-zinc-500">
              気象条件とカレンダー予定（PIIサニタイズ済）
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* 天気設定 */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                <Sun className="h-4 w-4 text-amber-500" />
                <span>Google Maps Platform Weather</span>
              </span>
              {weather && (
                <span className="rounded-lg bg-zinc-100 px-2.5 py-0.5 text-xs font-bold text-zinc-800">
                  {weather.location_name} ({weather.afternoon_temp_c}℃)
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {POPULAR_CITIES.map((city) => (
                <button
                  key={city}
                  onClick={() => onSelectCity(city)}
                  className={`rounded-lg px-2.5 py-1 text-xs transition border ${
                    weather?.location_name.includes(city.split("・")[0])
                      ? "bg-zinc-900 text-white border-zinc-900 font-bold"
                      : "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400"
                  }`}
                >
                  {city}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="他の地域（例: 金沢、那覇など）"
                value={customCity}
                onChange={(e) => setCustomCity(e.target.value)}
                className="flex-1 rounded-xl border border-zinc-200 px-3 py-1.5 text-xs focus:border-zinc-900 focus:outline-none"
              />
              <button
                onClick={() => {
                  if (customCity.trim()) {
                    onSelectCity(customCity.trim());
                    setCustomCity("");
                  }
                }}
                className="rounded-xl bg-zinc-900 text-white px-3 py-1.5 text-xs font-bold hover:bg-zinc-800"
              >
                変更
              </button>
            </div>

            {/* 体感温度（寒がり/暑がり） */}
            <div className="rounded-xl bg-zinc-50 p-3 border border-zinc-100 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 font-semibold text-zinc-700">
                <Thermometer className="h-4 w-4 text-zinc-500" />
                <span>体感の寒暖感受性:</span>
              </span>
              <div className="flex gap-1">
                {(
                  [
                    { val: -1, label: "暑がり" },
                    { val: 0, label: "標準" },
                    { val: 1, label: "寒がり" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.val}
                    onClick={() => onSensitivityChange(opt.val)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      profile.cold_sensitivity === opt.val
                        ? "bg-zinc-900 text-white shadow-xs"
                        : "bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-100"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Google Calendar 設定 */}
          <section className="space-y-3 pt-4 border-t border-zinc-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-indigo-600" />
                <span className="text-xs font-bold text-zinc-800">Google Calendar 連携</span>
              </div>
              <span className="flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-bold border border-emerald-200">
                <ShieldCheck className="h-3 w-3" /> PII サニタイズ
              </span>
            </div>

            <div className="flex items-center gap-2">
              {gcalStatus === "disconnected" ? (
                <>
                  <button
                    onClick={() => onConnectGoogleCalendar(false)}
                    disabled={isGCalLoading}
                    className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white py-2 text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isGCalLoading ? "animate-spin" : ""}`} />
                    <span>本番 Google カレンダーと連携</span>
                  </button>
                  <button
                    onClick={() => onConnectGoogleCalendar(true)}
                    disabled={isGCalLoading}
                    className="rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 px-3 py-2 text-xs font-bold transition"
                  >
                    デモ同期
                  </button>
                </>
              ) : (
                <div className="flex items-center justify-between w-full rounded-xl bg-indigo-50 border border-indigo-200 p-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-900">
                    <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
                    <span>{gcalStatus === "connected_real" ? "本番カレンダー同期中" : "デモカレンダー同期中"}</span>
                  </div>
                  <button
                    onClick={onDisconnectGoogleCalendar}
                    className="rounded-lg bg-white border border-indigo-200 px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50"
                  >
                    解除
                  </button>
                </div>
              )}
            </div>

            {/* 予定一覧 & 手動追加 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-700">
                <span>本日の予定（{events.length}件）</span>
                <button
                  onClick={() => setIsAddingEvent(!isAddingEvent)}
                  className="flex items-center gap-1 text-[11px] text-zinc-900 font-bold hover:underline"
                >
                  <Plus className="h-3 w-3" />
                  <span>予定を追加</span>
                </button>
              </div>

              {isAddingEvent && (
                <form onSubmit={handleAddSubmit} className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="time"
                      value={newEvent.start_time}
                      onChange={(e) => setNewEvent({ ...newEvent, start_time: e.target.value })}
                      className="rounded-lg border border-zinc-200 bg-white p-1 text-xs"
                    />
                    <input
                      type="time"
                      value={newEvent.end_time}
                      onChange={(e) => setNewEvent({ ...newEvent, end_time: e.target.value })}
                      className="rounded-lg border border-zinc-200 bg-white p-1 text-xs"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="予定名（例: 渋谷オフィス出社、夜食事会）"
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs"
                  />
                  <div className="flex justify-end gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsAddingEvent(false)}
                      className="px-2 py-1 text-xs text-zinc-500"
                    >
                      キャンセル
                    </button>
                    <button
                      type="submit"
                      className="rounded-lg bg-indigo-700 text-white px-3 py-1 text-xs font-bold hover:bg-indigo-800"
                    >
                      追加
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {events.map((ev, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-xl bg-zinc-50 border border-zinc-100 p-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-[10px] text-zinc-400 shrink-0">
                        {ev.start_time}-{ev.end_time}
                      </span>
                      <span className="font-semibold text-zinc-800 truncate">{ev.title}</span>
                    </div>
                    <button
                      onClick={() => onDeleteEvent(idx)}
                      className="p-1 text-zinc-400 hover:text-red-600 transition shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

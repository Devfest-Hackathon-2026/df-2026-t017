"use client";

import React, { useState } from "react";
import {
  Calendar,
  CalendarDays,
  Clock,
  MapPin,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { RawCalendarEvent } from "@/types/closet";

interface CalendarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  events: RawCalendarEvent[];
  gcalStatus: "disconnected" | "connected_real" | "connected_demo";
  isGCalLoading: boolean;
  onConnectGoogleCalendar: (forceDemo?: boolean) => void;
  onDisconnectGoogleCalendar: () => void;
  onAddEvent: (event: RawCalendarEvent) => void;
  onDeleteEvent: (index: number) => void;
}

export function CalendarDrawer({
  isOpen,
  onClose,
  events,
  gcalStatus,
  isGCalLoading,
  onConnectGoogleCalendar,
  onDisconnectGoogleCalendar,
  onAddEvent,
  onDeleteEvent,
}: CalendarDrawerProps) {
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
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs transition"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 bg-zinc-50/50">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600">
              <Calendar className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900">Google カレンダー & スケジュール</h3>
              <p className="text-[11px] text-zinc-500">予定からTPO・活動量を判定しコーデに自動反映</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* 1. Google カレンダー連携ステータス */}
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 text-indigo-600" />
                <span>Google Calendar 同期</span>
              </span>
              <span className="flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-0.5 text-[10px] font-bold border border-emerald-200">
                <ShieldCheck className="h-3 w-3" /> PII 自動サニタイズ
              </span>
            </div>

            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Googleカレンダーから今日の予定を取得し、移動の多さやフォーマル度（商談・オフィス・会食等）を推論します。個人特定情報はAI送信前に自動マスクされます。
            </p>

            <div className="pt-1">
              {gcalStatus === "disconnected" ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => onConnectGoogleCalendar(false)}
                    disabled={isGCalLoading}
                    className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isGCalLoading ? "animate-spin" : ""}`} />
                    <span>本番 Google カレンダーと連携</span>
                  </button>
                  <button
                    onClick={() => onConnectGoogleCalendar(true)}
                    disabled={isGCalLoading}
                    className="rounded-xl border border-indigo-200 bg-white hover:bg-indigo-50 text-indigo-900 px-3.5 py-2.5 text-xs font-bold transition"
                  >
                    デモ同期
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between w-full rounded-xl bg-white border border-indigo-200 p-3 shadow-xs">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-900">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{gcalStatus === "connected_real" ? "本番カレンダー同期中" : "デモカレンダー同期中"}</span>
                  </div>
                  <button
                    onClick={onDisconnectGoogleCalendar}
                    className="rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-3 py-1.5 text-xs font-medium transition"
                  >
                    連携解除
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 2. 本日の予定一覧 & 手動追加 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-zinc-500" />
                <h4 className="text-xs font-bold text-zinc-800">
                  本日の予定リスト（{events.length}件）
                </h4>
              </div>
              <button
                onClick={() => setIsAddingEvent(!isAddingEvent)}
                className="flex items-center gap-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 px-2.5 py-1 text-xs font-bold text-zinc-800 transition"
              >
                <Plus className="h-3 w-3" />
                <span>予定を手動追加</span>
              </button>
            </div>

            {/* 新規予定追加フォーム */}
            {isAddingEvent && (
              <form
                onSubmit={handleAddSubmit}
                className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3.5 space-y-2.5 text-xs animate-in fade-in duration-150"
              >
                <div className="text-[11px] font-bold text-indigo-950">予定の手動登録</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-zinc-500 block mb-0.5">開始時刻</label>
                    <input
                      type="time"
                      value={newEvent.start_time}
                      onChange={(e) => setNewEvent({ ...newEvent, start_time: e.target.value })}
                      className="w-full rounded-lg border border-zinc-200 bg-white p-1.5 text-xs focus:border-zinc-900 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 block mb-0.5">終了時刻</label>
                    <input
                      type="time"
                      value={newEvent.end_time}
                      onChange={(e) => setNewEvent({ ...newEvent, end_time: e.target.value })}
                      className="w-full rounded-lg border border-zinc-200 bg-white p-1.5 text-xs focus:border-zinc-900 focus:outline-none"
                    />
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="予定名（例: 渋谷オフィス出社、夜食事会）"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs focus:border-zinc-900 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="場所（任意: 渋谷ヒカリエ、リモートなど）"
                  value={newEvent.location}
                  onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs focus:border-zinc-900 focus:outline-none"
                />
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingEvent(false)}
                    className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-700"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-indigo-600 text-white px-4 py-1.5 text-xs font-bold hover:bg-indigo-700 transition"
                  >
                    追加して反映
                  </button>
                </div>
              </form>
            )}

            {/* 予定リスト */}
            {events.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-200 p-6 text-center text-xs text-zinc-400">
                本日の予定はありません。「予定を手動追加」または「Google カレンダー連携」から予定を登録できます。
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {events.map((ev, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-xl bg-zinc-50 border border-zinc-200/80 p-3 text-xs hover:border-zinc-300 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex flex-col text-left font-mono text-[11px] text-zinc-400 shrink-0">
                        <span className="font-semibold text-zinc-700">{ev.start_time}</span>
                        <span>{ev.end_time}</span>
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-zinc-900 block truncate">{ev.title}</span>
                        {ev.location && (
                          <span className="text-[10px] text-zinc-500 flex items-center gap-1 mt-0.5 truncate">
                            <MapPin className="h-3 w-3" />
                            <span>{ev.location}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => onDeleteEvent(idx)}
                      className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition shrink-0 ml-2"
                      title="この予定を削除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. TPO推論ミニガイド */}
          <div className="rounded-xl bg-zinc-50 border border-zinc-200/70 p-3.5 space-y-1.5 text-xs">
            <span className="font-bold text-zinc-700 block text-[11px]">💡 スケジュール連動の仕組み</span>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              予定の内容（「商談」「出社」「食事」「外回り」等）から、その日に最適なフォーマル度（Lv.1〜5）と移動時の快適性をAIが自動算出し、服装を提案します。
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-200 px-5 py-3.5 bg-zinc-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl bg-zinc-900 text-white px-5 py-2 text-xs font-bold hover:bg-zinc-800 transition"
          >
            完了
          </button>
        </div>
      </div>
    </div>
  );
}

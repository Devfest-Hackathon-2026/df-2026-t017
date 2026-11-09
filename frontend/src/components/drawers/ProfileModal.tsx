"use client";

import React, { useEffect, useState } from "react";
import { Plus, Trash2, UserRound, X } from "lucide-react";
import { AgeGroup, ClosetProfile, GenderIdentity, PersonalColor } from "@/types/closet";

interface ProfileModalProps {
  isOpen: boolean;
  profiles: ClosetProfile[];
  activeProfileId: string;
  onClose: () => void;
  onSave: (profile: ClosetProfile) => void;
  onCreate: (profile: ClosetProfile) => void;
  onSwitch: (profileId: string) => void;
  onDelete: (profileId: string) => void;
}

const genderOptions: Array<{ value: GenderIdentity; label: string }> = [
  { value: "male", label: "男性" },
  { value: "female", label: "女性" },
  { value: "unspecified", label: "指定しない" },
];

const colorOptions: Array<{ value: PersonalColor; label: string }> = [
  { value: "spring", label: "イエベ春" },
  { value: "autumn", label: "イエベ秋" },
  { value: "summer", label: "ブルベ夏" },
  { value: "winter", label: "ブルベ冬" },
  { value: "unknown", label: "未診断" },
];

const ageOptions: Array<{ value: AgeGroup; label: string }> = [
  { value: "teens", label: "10代" },
  { value: "20s", label: "20代" },
  { value: "30s", label: "30代" },
  { value: "40s", label: "40代" },
  { value: "50s", label: "50代" },
  { value: "60s_plus", label: "60代以上" },
  { value: "unspecified", label: "指定しない" },
];

export function ProfileModal({
  isOpen,
  profiles,
  activeProfileId,
  onClose,
  onSave,
  onCreate,
  onSwitch,
  onDelete,
}: ProfileModalProps) {
  const active = profiles.find((profile) => profile.id === activeProfileId) || profiles[0];
  const [draft, setDraft] = useState<ClosetProfile>(active);

  useEffect(() => setDraft(active), [active]);
  if (!isOpen || !draft) return null;

  const createProfile = () => {
    const id = `profile_${Date.now()}`;
    onCreate({
      ...draft,
      id,
      name: `プロフィール ${profiles.length + 1}`,
      personal_clo_offset: 0,
      feedback_count: 0,
      banned_item_ids: [],
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-100 bg-white px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold"><UserRound className="h-5 w-5" />マイページ</h2>
            <p className="mt-0.5 text-[11px] text-zinc-500">プロフィールごとにクローゼットと体感学習を分けます</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-5 p-5">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-bold text-zinc-700">プロフィール切り替え</label>
              <button onClick={createProfile} className="flex items-center gap-1 rounded-lg bg-zinc-900 px-2.5 py-1.5 text-[11px] font-bold text-white"><Plus className="h-3.5 w-3.5" />追加</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {profiles.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSwitch(item.id)}
                  className={`rounded-xl border p-3 text-left transition ${item.id === activeProfileId ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 hover:bg-zinc-50"}`}
                >
                  <span className="block truncate text-xs font-bold">{item.name}</span>
                  <span className={`text-[10px] ${item.id === activeProfileId ? "text-zinc-300" : "text-zinc-400"}`}>学習 {item.feedback_count || 0}回</span>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-zinc-200 p-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold">表示名</label>
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900" />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold">性別</label>
              <div className="grid grid-cols-3 gap-2">
                {genderOptions.map((option) => <button key={option.value} onClick={() => setDraft({ ...draft, gender: option.value })} className={`rounded-xl border px-2 py-2 text-xs font-semibold ${draft.gender === option.value ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200"}`}>{option.label}</button>)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-bold">パーソナルカラー
                <select value={draft.personal_color} onChange={(e) => setDraft({ ...draft, personal_color: e.target.value as PersonalColor })} className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-2.5 py-2 text-xs font-medium">
                  {colorOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="text-xs font-bold">年代
                <select value={draft.age_group} onChange={(e) => setDraft({ ...draft, age_group: e.target.value as AgeGroup })} className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-2.5 py-2 text-xs font-medium">
                  {ageOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold">体感の初期設定</label>
              <div className="grid grid-cols-3 gap-2">
                {[{ value: -1, label: "暑がり" }, { value: 0, label: "標準" }, { value: 1, label: "寒がり" }].map((option) => <button key={option.value} onClick={() => setDraft({ ...draft, cold_sensitivity: option.value })} className={`rounded-xl border px-2 py-2 text-xs font-semibold ${draft.cold_sensitivity === option.value ? "border-amber-500 bg-amber-50 text-amber-900" : "border-zinc-200"}`}>{option.label}</button>)}
              </div>
              <p className="mt-2 text-[10px] text-zinc-500">学習補正: {(draft.personal_clo_offset || 0) > 0 ? "+" : ""}{draft.personal_clo_offset || 0} Clo / フィードバック {draft.feedback_count || 0}回</p>
            </div>
          </section>

          <div className="flex gap-2">
            {profiles.length > 1 && <button onClick={() => onDelete(activeProfileId)} className="flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-2.5 text-xs font-bold text-red-600"><Trash2 className="h-4 w-4" />削除</button>}
            <button onClick={() => { onSave(draft); onClose(); }} className="flex-1 rounded-xl bg-zinc-900 py-2.5 text-sm font-bold text-white">保存する</button>
          </div>
        </div>
      </div>
    </div>
  );
}

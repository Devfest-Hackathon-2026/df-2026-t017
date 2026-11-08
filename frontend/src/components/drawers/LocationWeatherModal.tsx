"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  Check,
  CloudRain,
  Home,
  LocateFixed,
  MapPin,
  RefreshCw,
  Search,
  Thermometer,
  Umbrella,
  Wind,
  X,
} from "lucide-react";
import { UserProfile, WeatherSnapshot } from "@/types/closet";

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

interface LocationWeatherModalProps {
  isOpen: boolean;
  onClose: () => void;
  weather: WeatherSnapshot | null;
  profile: UserProfile;
  homeLocation?: string | null;
  destinationLocation?: string | null;
  umbrellaType?: "none" | "folding" | "umbrella";
  umbrellaAdvice?: string;
  isLoadingWeather?: boolean;
  onSelectCity: (cityName: string) => Promise<void> | void;
  onSelectCoords: (lat: number, lng: number) => Promise<void> | void;
  onSetHomeLocation: (locationName: string) => void;
  onSensitivityChange: (delta: number) => void;
}

export function LocationWeatherModal({
  isOpen,
  onClose,
  weather,
  profile,
  homeLocation,
  destinationLocation,
  umbrellaType = "none",
  umbrellaAdvice,
  isLoadingWeather = false,
  onSelectCity,
  onSelectCoords,
  onSetHomeLocation,
  onSensitivityChange,
}: LocationWeatherModalProps) {
  const [customCity, setCustomCity] = useState("");
  const [geoError, setGeoError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  if (!isOpen) return null;

  // ブラウザの Geolocation API で現在地を取得
  const handleGetLocation = () => {
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError("お使いのブラウザは位置情報取得に対応していません。");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await onSelectCoords(pos.coords.latitude, pos.coords.longitude);
        } catch {
          setGeoError("現在地の気象データ取得に失敗しました。");
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        setIsLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError("位置情報の利用が許可されていません。ブラウザ設定を確認するか、都市名を選択してください。");
        } else {
          setGeoError("位置情報の取得に失敗しました。");
        }
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleCustomCitySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customCity.trim()) return;
    onSelectCity(customCity.trim());
    setCustomCity("");
  };

  const isCurrentLocationHome =
    Boolean(weather?.location_name && homeLocation && weather.location_name.includes(homeLocation));

  const tempDiff = weather
    ? Math.round((weather.afternoon_temp_c - weather.evening_temp_c) * 10) / 10
    : 0;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-4 transition animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 bg-zinc-50/50">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
              <MapPin className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900">場所・気象設定</h3>
              <p className="text-[11px] text-zinc-500">居住区の天候と行く場所の雨・寒暖差を管理</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* 1. デフォルト居住区バー */}
          <div className="rounded-xl border border-zinc-200/80 bg-zinc-50 p-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <Home className="h-4 w-4 text-zinc-600 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] text-zinc-400 block">デフォルト居住区</span>
                <span className="font-bold text-zinc-800 truncate block">
                  {homeLocation || "未設定（自宅エリアを保存できます）"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {homeLocation && !isCurrentLocationHome && (
                <button
                  type="button"
                  onClick={() => onSelectCity(homeLocation)}
                  className="rounded-lg bg-white border border-zinc-200 hover:border-zinc-400 px-2.5 py-1 text-[11px] font-medium text-zinc-700 transition"
                  title="居住区の天気に戻す"
                >
                  居住区に戻す
                </button>
              )}
              {weather?.location_name && (
                <button
                  type="button"
                  onClick={() => onSetHomeLocation(weather.location_name)}
                  disabled={isCurrentLocationHome}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition flex items-center gap-1 ${
                    isCurrentLocationHome
                      ? "bg-zinc-200 text-zinc-500 cursor-default"
                      : "bg-zinc-900 text-white hover:bg-zinc-800"
                  }`}
                >
                  {isCurrentLocationHome ? (
                    <>
                      <Check className="h-3 w-3" />
                      <span>設定中</span>
                    </>
                  ) : (
                    <span>ここを居住区に設定</span>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* 2. 現在地GPS取得ボタン */}
          <div>
            <button
              onClick={handleGetLocation}
              disabled={isLocating || isLoadingWeather}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white py-2.5 px-4 text-xs font-bold transition shadow-xs disabled:opacity-50"
            >
              {isLocating || isLoadingWeather ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin text-zinc-400" />
                  <span>位置情報と天気を取得中...</span>
                </>
              ) : (
                <>
                  <LocateFixed className="h-4 w-4 text-amber-400" />
                  <span>GPSで現在地を取得して天気を自動同期</span>
                </>
              )}
            </button>
            {geoError && (
              <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-red-50 p-2 text-[11px] text-red-600 border border-red-200">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{geoError}</span>
              </div>
            )}
          </div>

          {/* 3. 天気スナップショットカード */}
          {weather && (
            <div className="rounded-2xl border border-zinc-200 bg-linear-to-br from-amber-50/40 via-white to-sky-50/30 p-4 space-y-3.5 shadow-xs">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-zinc-900 text-base">{weather.location_name}</span>
                    <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold">
                      同期中
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5 font-medium">{weather.condition_label}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-zinc-900 tracking-tight">
                    {weather.afternoon_temp_c}
                    <span className="text-sm font-bold text-zinc-500">℃</span>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-medium">日中最高気温</span>
                </div>
              </div>

              {/* 朝・昼・夕の気温推移タイムライン */}
              <div className="rounded-xl bg-white/80 border border-zinc-200/70 p-3 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-zinc-500 font-medium">
                  <span>1日の気温推移</span>
                  {tempDiff >= 5.0 && (
                    <span className="text-[10px] text-amber-700 font-bold bg-amber-100 px-1.5 py-0.5 rounded">
                      寒暖差 {tempDiff}℃ 注意
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-zinc-50 p-2 border border-zinc-100">
                    <span className="text-[10px] text-zinc-400 block">朝 (08:00)</span>
                    <span className="text-xs font-bold text-zinc-700">{weather.morning_temp_c}℃</span>
                  </div>
                  <div className="rounded-lg bg-amber-50/60 p-2 border border-amber-200/50">
                    <span className="text-[10px] text-amber-700 font-bold block">日中 (14:00)</span>
                    <span className="text-xs font-bold text-amber-900">{weather.afternoon_temp_c}℃</span>
                  </div>
                  <div className="rounded-lg bg-sky-50/60 p-2 border border-sky-200/50">
                    <span className="text-[10px] text-sky-700 font-bold block">夜 (20:00)</span>
                    <span className="text-xs font-bold text-sky-900">{weather.evening_temp_c}℃</span>
                  </div>
                </div>
              </div>

              {/* 降水確率 & 風速 */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2 rounded-xl bg-white/80 border border-zinc-200/70 p-2.5">
                  <CloudRain className="h-4 w-4 text-sky-600 shrink-0" />
                  <div>
                    <span className="text-[10px] text-zinc-400 block">降水確率</span>
                    <span className="font-bold text-zinc-800">
                      {Math.round(weather.rain_probability * 100)}%
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-white/80 border border-zinc-200/70 p-2.5">
                  <Wind className="h-4 w-4 text-teal-600 shrink-0" />
                  <div>
                    <span className="text-[10px] text-zinc-400 block">風速</span>
                    <span className="font-bold text-zinc-800">{weather.wind_speed_ms} m/s</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. 行く場所と傘アドバイスカード */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                <Umbrella className="h-4 w-4 text-indigo-600" />
                <span>本日の傘アドバイス</span>
              </span>

              {/* 傘バッジ */}
              {umbrellaType === "umbrella" ? (
                <span className="rounded-full bg-blue-100 text-blue-900 px-2.5 py-0.5 text-[11px] font-bold">
                  長傘が必要
                </span>
              ) : umbrellaType === "folding" ? (
                <span className="rounded-full bg-indigo-100 text-indigo-900 px-2.5 py-0.5 text-[11px] font-bold">
                  折りたたみ傘推奨
                </span>
              ) : (
                <span className="rounded-full bg-zinc-100 text-zinc-700 px-2.5 py-0.5 text-[11px] font-semibold">
                  傘は不要
                </span>
              )}
            </div>

            {destinationLocation && (
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                <MapPin className="h-3 w-3 text-zinc-400 shrink-0" />
                <span>行く場所（予定地）: </span>
                <span className="font-semibold text-zinc-800">{destinationLocation}</span>
              </div>
            )}

            <p className="text-xs text-zinc-600 leading-relaxed bg-zinc-50 rounded-xl p-2.5 border border-zinc-100">
              {umbrellaAdvice || (
                umbrellaType === "umbrella"
                  ? "まとまった雨が予想されます。しっかりした長傘とお足元（撥水靴等）の対策が安心です。"
                  : umbrellaType === "folding"
                  ? "急な雨や移動時の備えに、折りたたみ傘をバッグに入れておくと安心です。"
                  : "一日を通して雨の心配はほぼありません。傘を持たずに身軽にお出かけできます。"
              )}
            </p>
          </div>

          {/* 5. 主要都市クイック選択 */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-zinc-700 block">主要エリアから選択</span>
            <div className="flex flex-wrap gap-1.5">
              {POPULAR_CITIES.map((city) => {
                const isSelected = weather?.location_name.includes(city.split("・")[0]);
                return (
                  <button
                    key={city}
                    onClick={() => onSelectCity(city)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-medium transition border ${
                      isSelected
                        ? "bg-zinc-900 text-white border-zinc-900 font-bold shadow-xs"
                        : "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50"
                    }`}
                  >
                    {city}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 6. 地域自由検索 */}
          <form onSubmit={handleCustomCitySubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
              <input
                type="text"
                placeholder="市区町村名を入力（例: 那覇、金沢、世田谷など）"
                value={customCity}
                onChange={(e) => setCustomCity(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-white pl-8 pr-3 py-2 text-xs text-zinc-800 placeholder-zinc-400 focus:border-zinc-900 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={!customCity.trim()}
              className="rounded-xl bg-zinc-900 text-white px-4 py-2 text-xs font-bold hover:bg-zinc-800 disabled:opacity-40 transition"
            >
              設定
            </button>
          </form>

          {/* 7. 体感温度（寒暖感受性）設定 */}
          <div className="rounded-2xl bg-zinc-50 border border-zinc-200/80 p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-bold text-zinc-800">
                <Thermometer className="h-4 w-4 text-amber-500" />
                <span>体感の寒暖感受性</span>
              </span>
              <span className="text-[10px] text-zinc-400">目標Clo値を自動パーソナライズ</span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 pt-1">
              {(
                [
                  { val: -1, label: "暑がり", desc: "-0.15 Clo (薄着寄り)" },
                  { val: 0, label: "標準", desc: "標準設定" },
                  { val: 1, label: "寒がり", desc: "+0.20 Clo (暖かめ)" },
                ] as const
              ).map((opt) => {
                const isActive = profile.cold_sensitivity === opt.val;
                return (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => onSensitivityChange(opt.val)}
                    className={`rounded-xl p-2 text-center transition border ${
                      isActive
                        ? "bg-zinc-900 text-white border-zinc-900 shadow-xs font-bold"
                        : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100"
                    }`}
                  >
                    <span className="text-xs block">{opt.label}</span>
                    <span className={`text-[9px] block mt-0.5 ${isActive ? "text-zinc-300" : "text-zinc-400"}`}>
                      {opt.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="border-t border-zinc-200 px-5 py-3 bg-zinc-50/50 flex justify-end">
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

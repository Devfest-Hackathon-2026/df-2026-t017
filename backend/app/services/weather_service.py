import json
import logging
import os
import urllib.parse
import urllib.request
from typing import Optional

from app.core.config import settings
from app.models.schemas import WeatherSnapshot

logger = logging.getLogger(__name__)

# 日本主要都市のリアルなフォールバック気象データ（Google Maps Weather API未設定時やオフライン時に使用）
FALLBACK_CITY_WEATHER: dict[str, WeatherSnapshot] = {
    "東京": WeatherSnapshot(
        location_name="東京・渋谷",
        morning_temp_c=13.5,
        afternoon_temp_c=18.0,
        evening_temp_c=11.5,
        wind_speed_ms=3.2,
        rain_probability=0.20,
        condition_label="晴れ時々曇り（夕方冷え込み）",
    ),
    "横浜": WeatherSnapshot(
        location_name="神奈川・横浜",
        morning_temp_c=14.0,
        afternoon_temp_c=18.5,
        evening_temp_c=12.0,
        wind_speed_ms=4.1,
        rain_probability=0.30,
        condition_label="曇り・海風やや強い",
    ),
    "大阪": WeatherSnapshot(
        location_name="大阪・梅田",
        morning_temp_c=15.0,
        afternoon_temp_c=20.5,
        evening_temp_c=14.0,
        wind_speed_ms=2.5,
        rain_probability=0.10,
        condition_label="快晴・過ごしやすい秋晴れ",
    ),
    "京都": WeatherSnapshot(
        location_name="京都・烏丸",
        morning_temp_c=11.0,
        afternoon_temp_c=19.0,
        evening_temp_c=10.5,
        wind_speed_ms=1.8,
        rain_probability=0.15,
        condition_label="晴れ（朝晩の寒暖差大）",
    ),
    "名古屋": WeatherSnapshot(
        location_name="愛知・名古屋",
        morning_temp_c=13.0,
        afternoon_temp_c=19.0,
        evening_temp_c=12.5,
        wind_speed_ms=2.8,
        rain_probability=0.20,
        condition_label="晴れ・穏やか",
    ),
    "福岡": WeatherSnapshot(
        location_name="福岡・天神",
        morning_temp_c=16.0,
        afternoon_temp_c=21.5,
        evening_temp_c=15.0,
        wind_speed_ms=3.0,
        rain_probability=0.45,
        condition_label="曇り一時雨",
    ),
    "札幌": WeatherSnapshot(
        location_name="北海道・札幌",
        morning_temp_c=5.0,
        afternoon_temp_c=9.5,
        evening_temp_c=4.0,
        wind_speed_ms=4.5,
        rain_probability=0.60,
        condition_label="小雨・初冬の冷え込み",
    ),
    "仙台": WeatherSnapshot(
        location_name="宮城・仙台",
        morning_temp_c=9.0,
        afternoon_temp_c=14.0,
        evening_temp_c=8.0,
        wind_speed_ms=3.5,
        rain_probability=0.25,
        condition_label="曇り・肌寒い北風",
    ),
}


def fetch_weather_from_google_maps(
    location: str,
    api_key: Optional[str] = None,
) -> Optional[WeatherSnapshot]:
    """
    Google Maps Platform Weather API (または Geocoding + Weather API) を呼び出し、
    時間帯別の気温・風速・降水確率を構造化して返す。
    キー未指定・エラー時は None を返し、フォールバックへ安全に委譲する。
    """
    key = api_key or settings.google_maps_api_key
    if not key:
        return None

    try:
        # 1. Geocoding で緯度経度を取得
        geocode_url = (
            f"https://maps.googleapis.com/maps/api/geocode/json?"
            f"address={urllib.parse.quote(location)}&language=ja&key={key}"
        )
        req = urllib.request.Request(geocode_url, headers={"User-Agent": "ClosetMe/1.0"})
        with urllib.request.urlopen(req, timeout=4) as response:
            geo_data = json.loads(response.read().decode("utf-8"))

        if not geo_data.get("results"):
            logger.warning("Geocoding returned no results for %s", location)
            return None

        first_res = geo_data["results"][0]
        formatted_address = first_res.get("formatted_address", location)
        lat = first_res["geometry"]["location"]["lat"]
        lng = first_res["geometry"]["location"]["lng"]

        # 2. Open-Meteo または Google Weather API（連携仕様）
        # Google Maps Weather API はプライベートプレビュー / パートナー先行等のケースがあるため、
        # 緯度経度から高精度時間別気象データを取得
        forecast_url = (
            f"https://api.open-meteo.com/v1/forecast?"
            f"latitude={lat}&longitude={lng}&hourly=temperature_2m,precipitation_probability,wind_speed_10m"
            f"&timezone=auto&forecast_days=1"
        )
        req_forecast = urllib.request.Request(forecast_url, headers={"User-Agent": "ClosetMe/1.0"})
        with urllib.request.urlopen(req_forecast, timeout=4) as forecast_resp:
            forecast_data = json.loads(forecast_resp.read().decode("utf-8"))

        hourly = forecast_data.get("hourly", {})
        temps = hourly.get("temperature_2m", [])
        rain_probs = hourly.get("precipitation_probability", [])
        winds = hourly.get("wind_speed_10m", [])

        # 朝(08:00=インデックス8), 昼(14:00=インデックス14), 夜(20:00=インデックス20)
        morning_temp = float(temps[8]) if len(temps) > 8 else 14.0
        afternoon_temp = float(temps[14]) if len(temps) > 14 else 18.0
        evening_temp = float(temps[20]) if len(temps) > 20 else 12.0

        max_rain = (max(rain_probs) / 100.0) if rain_probs else 0.1
        avg_wind = round(sum(winds) / len(winds), 1) if winds else 2.5

        condition = "晴れ"
        if max_rain >= 0.6:
            condition = "雨"
        elif max_rain >= 0.3:
            condition = "曇り一時雨"
        elif afternoon_temp - evening_temp >= 6.0:
            condition = "晴れ（夕方寒暖差注意）"

        # 地名表記をクリーンに整理
        short_name = formatted_address.split(",")[-1].strip()
        if "日本、" in short_name:
            short_name = short_name.replace("日本、", "").strip()

        return WeatherSnapshot(
            location_name=short_name or location,
            morning_temp_c=round(morning_temp, 1),
            afternoon_temp_c=round(afternoon_temp, 1),
            evening_temp_c=round(evening_temp, 1),
            wind_speed_ms=avg_wind,
            rain_probability=round(max_rain, 2),
            condition_label=condition,
        )
    except Exception as e:
        logger.warning("Weather API lookup failed for %s: %s", location, e)
        return None


def get_weather_for_location(location: str) -> WeatherSnapshot:
    """
    指定された地域名（例: '東京', '渋谷', '大阪', '札幌' 等）から気象を取得。
    実APIが利用できればそれを優先し、不可の場合はプリセット辞書からマッチさせて返す。
    """
    # 1. 実API試行
    api_result = fetch_weather_from_google_maps(location)
    if api_result:
        return api_result

    # 2. 日本主要都市プリセット検索
    for city_key, snapshot in FALLBACK_CITY_WEATHER.items():
        if city_key in location or location in city_key:
            return snapshot

    # 3. 未知の都市の場合は東京ベースでロケーション名を反映したスナップショット
    return WeatherSnapshot(
        location_name=location,
        morning_temp_c=13.0,
        afternoon_temp_c=18.0,
        evening_temp_c=11.5,
        wind_speed_ms=2.8,
        rain_probability=0.15,
        condition_label="晴れ時々曇り",
    )

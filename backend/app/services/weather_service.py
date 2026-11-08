import json
import logging
import os
import urllib.parse
import urllib.request
from typing import Optional

from app.core.config import settings
from app.models.schemas import EventWeather, RawCalendarEvent, WeatherSnapshot

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


def reverse_geocode(lat: float, lng: float, api_key: Optional[str] = None) -> str:
    """緯度経度から市区町村名（日本語）を逆ジオコーディングで取得する。"""
    key = api_key or settings.google_maps_api_key
    if key:
        try:
            url = f"https://maps.googleapis.com/maps/api/geocode/json?latlng={lat},{lng}&language=ja&key={key}"
            req = urllib.request.Request(url, headers={"User-Agent": "ClosetMe/1.0"})
            with urllib.request.urlopen(req, timeout=4) as response:
                geo_data = json.loads(response.read().decode("utf-8"))
            if geo_data.get("results"):
                for res in geo_data["results"]:
                    # 市区町村レベルのコンポーネントを探す
                    components = res.get("address_components", [])
                    locality = ""
                    admin_area = ""
                    for c in components:
                        types = c.get("types", [])
                        if "locality" in types or "sublocality_level_1" in types:
                            locality = c.get("long_name", "")
                        if "administrative_area_level_1" in types:
                            admin_area = c.get("long_name", "")
                    if locality:
                        return f"{admin_area} {locality}".strip()
                formatted = geo_data["results"][0].get("formatted_address", "")
                cleaned = formatted.split(",")[-1].strip().replace("日本、", "").strip()
                if cleaned:
                    return cleaned
        except Exception as e:
            logger.warning("Google reverse geocoding failed: %s", e)

    # フォールバック: OpenStreetMap Nominatim (OSM)
    try:
        osm_url = f"https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lng}&format=json&accept-language=ja"
        req = urllib.request.Request(osm_url, headers={"User-Agent": "ClosetMeApp/1.0 (contact@closetme.dev)"})
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            address = data.get("address", {})
            city = address.get("city") or address.get("ward") or address.get("town") or address.get("suburb") or address.get("province")
            state = address.get("province") or address.get("state") or ""
            if city:
                return f"{state} {city}".strip()
    except Exception as e:
        logger.warning("OSM reverse geocoding fallback failed: %s", e)

    return f"現在地 ({round(lat, 2)}, {round(lng, 2)})"


def fetch_weather_by_coordinates(lat: float, lng: float, custom_name: Optional[str] = None) -> Optional[WeatherSnapshot]:
    """緯度経度からOpen-Meteo時間別気象データを取得してWeatherSnapshotを構築する。"""
    try:
        location_name = custom_name or reverse_geocode(lat, lng)

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

        return WeatherSnapshot(
            location_name=location_name,
            morning_temp_c=round(morning_temp, 1),
            afternoon_temp_c=round(afternoon_temp, 1),
            evening_temp_c=round(evening_temp, 1),
            wind_speed_ms=avg_wind,
            rain_probability=round(max_rain, 2),
            condition_label=condition,
        )
    except Exception as e:
        logger.warning("Weather fetch by coords failed (lat=%s, lng=%s): %s", lat, lng, e)
        return None


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


def get_weather_for_location(
    location: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
) -> WeatherSnapshot:
    """
    指定された地域名または緯度経度（GPS現在地）から気象を取得。
    実APIが利用できればそれを優先し、不可の場合はプリセット辞書からマッチさせて返す。
    """
    # 0. 緯度経度指定がある場合 (GPS現在地)
    if lat is not None and lng is not None:
        coords_result = fetch_weather_by_coordinates(lat, lng, custom_name=location)
        if coords_result:
            return coords_result

    target_loc = location or "東京"

    # 1. 実API試行
    api_result = fetch_weather_from_google_maps(target_loc)
    if api_result:
        return api_result

    # 2. 日本主要都市プリセット検索
    for city_key, snapshot in FALLBACK_CITY_WEATHER.items():
        if city_key in target_loc or target_loc in city_key:
            return snapshot

    # 3. 未知の都市の場合は東京ベースでロケーション名を反映したスナップショット
    return WeatherSnapshot(
        location_name=target_loc,
        morning_temp_c=13.0,
        afternoon_temp_c=18.0,
        evening_temp_c=11.5,
        wind_speed_ms=2.8,
        rain_probability=0.15,
        condition_label="晴れ時々曇り",
    )


# ---------------------------------------------------------
# 予定（時間・場所）ごとのピンポイント気象取得 & 付与
# ---------------------------------------------------------

_HOURLY_CACHE: dict[str, dict] = {}


def _parse_hour_from_time_str(time_str: str) -> int:
    """'10:00', '19:30' などの文字列から時間を整数(0~23)で安全に取り出す。"""
    try:
        parts = time_str.strip().split(":")
        h = int(parts[0])
        return max(0, min(23, h))
    except Exception:
        return 12


def fetch_hourly_weather_data(location: str, lat: Optional[float] = None, lng: Optional[float] = None) -> Optional[dict]:
    """指定場所の1日24時間の時間別気象データをOpen-Meteoから取得してキャッシュする。"""
    cache_key = f"{lat},{lng}" if (lat and lng) else location
    if cache_key in _HOURLY_CACHE:
        return _HOURLY_CACHE[cache_key]

    target_lat = lat
    target_lng = lng

    # 緯度経度が未指定の場合、Google Geocoding または都市辞書から解決
    if target_lat is None or target_lng is None:
        key = settings.google_maps_api_key
        if key:
            try:
                geocode_url = f"https://maps.googleapis.com/maps/api/geocode/json?address={urllib.parse.quote(location)}&language=ja&key={key}"
                req = urllib.request.Request(geocode_url, headers={"User-Agent": "ClosetMe/1.0"})
                with urllib.request.urlopen(req, timeout=3) as res:
                    geo = json.loads(res.read().decode("utf-8"))
                if geo.get("results"):
                    target_lat = geo["results"][0]["geometry"]["location"]["lat"]
                    target_lng = geo["results"][0]["geometry"]["location"]["lng"]
            except Exception as e:
                logger.warning("Geocoding in hourly fetch failed: %s", e)

    # 日本主要都市のデフォルト座標
    if target_lat is None or target_lng is None:
        coords_map = {
            "渋谷": (35.6580, 139.7016),
            "新宿": (35.6938, 139.7034),
            "銀座": (35.6719, 139.7649),
            "東京": (35.6812, 139.7671),
            "横浜": (35.4437, 139.6380),
            "大阪": (34.7024, 135.4959),
            "梅田": (34.7024, 135.4959),
            "京都": (35.0037, 135.7588),
            "名古屋": (35.1709, 136.8815),
            "福岡": (33.5902, 130.4017),
            "札幌": (43.0642, 141.3469),
            "仙台": (38.2682, 140.8694),
        }
        for city_k, coords in coords_map.items():
            if city_k in location:
                target_lat, target_lng = coords
                break

    if target_lat is None or target_lng is None:
        target_lat, target_lng = (35.6580, 139.7016)  # 東京・渋谷デフォルト

    try:
        url = (
            f"https://api.open-meteo.com/v1/forecast?"
            f"latitude={target_lat}&longitude={target_lng}"
            f"&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m"
            f"&timezone=auto&forecast_days=1"
        )
        req = urllib.request.Request(url, headers={"User-Agent": "ClosetMe/1.0"})
        with urllib.request.urlopen(req, timeout=4) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            hourly = data.get("hourly", {})
            if hourly:
                _HOURLY_CACHE[cache_key] = hourly
                return hourly
    except Exception as e:
        logger.warning("Open-Meteo hourly fetch failed: %s", e)

    return None


def get_weather_for_single_event(
    event: RawCalendarEvent,
    base_weather: WeatherSnapshot,
) -> EventWeather:
    """単一の予定の開始時間と場所からピンポイント気象(EventWeather)を算出する。"""
    hour = _parse_hour_from_time_str(event.start_time)
    target_loc = event.location.strip() if (event.location and event.location.strip()) else base_weather.location_name

    # 1. Open-Meteo 時間別実データの取得試行
    hourly = fetch_hourly_weather_data(target_loc)
    if hourly:
        temps = hourly.get("temperature_2m", [])
        rains = hourly.get("precipitation_probability", [])
        wcodes = hourly.get("weather_code", [])

        temp = float(temps[hour]) if len(temps) > hour else base_weather.afternoon_temp_c
        rain_prob = (float(rains[hour]) / 100.0) if len(rains) > hour else base_weather.rain_probability
        wcode = int(wcodes[hour]) if len(wcodes) > hour else 0

        # 天候 & アイコン判定
        is_night = hour < 6 or hour >= 18
        if rain_prob >= 0.4 or wcode in [51, 53, 55, 61, 63, 65, 80, 81, 82, 95]:
            condition = "雨" if rain_prob >= 0.6 else "小雨・通り雨注意"
            icon_type = "rain"
        elif wcode in [1, 2, 3] or (0.2 <= rain_prob < 0.4):
            condition = "曇り"
            icon_type = "cloud"
        else:
            condition = "晴れ"
            icon_type = "moon" if is_night else "sun"

        return EventWeather(
            temp_c=round(temp, 1),
            rain_probability=round(rain_prob, 2),
            condition=condition,
            icon_type=icon_type,
        )

    # 2. フォールバック: base_weather からの時間帯補間
    is_night = hour < 6 or hour >= 18
    if 6 <= hour <= 10:
        temp = base_weather.morning_temp_c
        rain_prob = base_weather.rain_probability * 0.8
    elif 11 <= hour <= 16:
        temp = base_weather.afternoon_temp_c
        rain_prob = base_weather.rain_probability
    else:
        temp = base_weather.evening_temp_c
        # 夕方・夜はにわか雨確率がやや上がるシチュエーション
        rain_prob = min(1.0, base_weather.rain_probability * 1.2)

    # 特定の地名による補正（銀座で夕方以降なら雨リスク設定等）
    if "銀座" in target_loc and hour >= 17 and rain_prob < 0.4:
        rain_prob = 0.45

    if rain_prob >= 0.4:
        condition = "雨" if rain_prob >= 0.6 else "小雨の心配"
        icon_type = "rain"
    elif rain_prob >= 0.2:
        condition = "曇り"
        icon_type = "cloud"
    else:
        condition = "晴れ"
        icon_type = "moon" if is_night else "sun"

    return EventWeather(
        temp_c=round(temp, 1),
        rain_probability=round(rain_prob, 2),
        condition=condition,
        icon_type=icon_type,
    )


def enrich_events_with_weather(
    events: list[RawCalendarEvent],
    base_weather: WeatherSnapshot,
) -> list[RawCalendarEvent]:
    """予定リストの全件に、その時間と場所に応じたEventWeatherを付与して返す。"""
    enriched: list[RawCalendarEvent] = []
    for ev in events:
        w = get_weather_for_single_event(ev, base_weather)
        enriched.append(
            RawCalendarEvent(
                start_time=ev.start_time,
                end_time=ev.end_time,
                title=ev.title,
                location=ev.location,
                weather=w,
            )
        )
    return enriched


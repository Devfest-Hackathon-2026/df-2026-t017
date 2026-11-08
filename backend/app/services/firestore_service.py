"""
Cloud Firestore 永続化 & 個人体感キャリブレーションサービス

本番GCP（Cloud Run on IAM / ADC キーレス認証）では Cloud Firestore ネイティブに保存し、
ローカル検証・デモモード時はローカル永続層（メモリ/JSON）でシームレスに動作。
ユーザーが「今日これを着る」を選んだ記録や、
「寒かった / ちょうどいい / 暑かった」の1タップ体感フィードバックによる個人Clo補正値を永続化する。
"""

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.core.config import settings
from app.core.logging import log_structured
from app.models.schemas import ComfortFeedbackRequest, ComfortFeedbackResponse

# ローカル永続化キャッシュ用（Firestore未接続時のフォールバック）
_LOCAL_CALIBRATION_CACHE: dict[str, dict[str, Any]] = {
    "demo-user": {
        "personal_clo_offset": 0.0,
        "feedback_count": 0,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
}

# ローカルJSONファイル保存パス
_DATA_DIR = Path(__file__).resolve().parents[2] / "data"
_CACHE_FILE = _DATA_DIR / "user_calibration.json"


def _load_local_cache() -> None:
    if _CACHE_FILE.exists():
        try:
            raw = _CACHE_FILE.read_text(encoding="utf-8")
            data = json.loads(raw)
            if isinstance(data, dict):
                _LOCAL_CALIBRATION_CACHE.update(data)
        except Exception as e:
            log_structured("WARNING", "Failed to load local calibration cache", error=str(e))


def _save_local_cache() -> None:
    try:
        _DATA_DIR.mkdir(parents=True, exist_ok=True)
        _CACHE_FILE.write_text(json.dumps(_LOCAL_CALIBRATION_CACHE, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as e:
        log_structured("WARNING", "Failed to save local calibration cache", error=str(e))


_load_local_cache()


def _get_firestore_client():
    if not (settings.enable_firestore and settings.gcp_project_id):
        return None
    try:
        from google.cloud import firestore

        return firestore.Client(project=settings.gcp_project_id)
    except Exception as exc:
        log_structured("WARNING", "Failed to initialize Firestore client", error=str(exc))
        return None


def get_user_calibration(uid: str) -> tuple[float, int, str]:
    """
    ユーザーの学習済み個人体感オフセット値 (Clo) とフィードバック回数を取得する。
    Returns: (offset, count, storage_source)
    """
    db = _get_firestore_client()
    if db is not None:
        try:
            doc_ref = db.collection("users").document(uid)
            doc = doc_ref.get()
            if doc.exists:
                data = doc.to_dict() or {}
                offset = float(data.get("personal_clo_offset", 0.0))
                count = int(data.get("feedback_count", 0))
                return round(offset, 3), count, "cloud-firestore"
        except Exception as exc:
            log_structured("WARNING", "Firestore get_user_calibration failed, using local", error=str(exc))

    user_data = _LOCAL_CALIBRATION_CACHE.get(uid, {"personal_clo_offset": 0.0, "feedback_count": 0})
    return round(float(user_data.get("personal_clo_offset", 0.0)), 3), int(user_data.get("feedback_count", 0)), "local-cache"


def record_comfort_feedback(uid: str, req: ComfortFeedbackRequest) -> ComfortFeedbackResponse:
    """
    着用後の体感フィードバック（cold / optimal / warm）を記録し、
    個人Clo基準値を自己学習・自動補正する。
      - cold: +0.08 Clo （寒かったので目標Cloレンジを高めに補正）
      - warm: -0.08 Clo （暑かったので目標Cloレンジを低めに補正）
      - optimal: ±0.00 Clo （現在の快適設定を維持・収束）
    """
    delta_map = {
        "cold": 0.08,
        "optimal": 0.00,
        "warm": -0.08,
    }
    delta = delta_map.get(req.feedback, 0.0)

    current_offset, current_count, _ = get_user_calibration(uid)
    new_offset = round(max(-0.40, min(0.40, current_offset + delta)), 3)
    new_count = current_count + 1
    now_iso = datetime.now(timezone.utc).isoformat()

    feedback_label = {
        "cold": "「少し寒かった」",
        "optimal": "「ちょうどよかった」",
        "warm": "「少し暑かった」",
    }.get(req.feedback, "")

    if delta > 0:
        msg = f"{feedback_label}の記録を反映しました。体感オフセットを +{delta:.2f} Clo 補正し、次回から暖かめの組み合わせを優先します。"
    elif delta < 0:
        msg = f"{feedback_label}の記録を反映しました。体感オフセットを {delta:.2f} Clo 補正し、熱がこもりにくい組み合わせを優先します。"
    else:
        msg = f"{feedback_label}のフィードバックを記録しました。現在の断熱レンジ（オフセット {new_offset:+.2f} Clo）があなたに最適です。"

    storage_source = "local-cache"
    db = _get_firestore_client()
    if db is not None:
        try:
            user_ref = db.collection("users").document(uid)
            user_ref.set(
                {
                    "personal_clo_offset": new_offset,
                    "feedback_count": new_count,
                    "updated_at": now_iso,
                },
                merge=True,
            )
            # フィードバック履歴をサブコレクションへ追記
            user_ref.collection("feedback_logs").add(
                {
                    "feedback": req.feedback,
                    "delta": delta,
                    "resulting_offset": new_offset,
                    "worn_item_ids": req.worn_item_ids,
                    "actual_total_clo": req.actual_total_clo,
                    "weather_temp_c": req.weather_temp_c,
                    "created_at": now_iso,
                }
            )
            storage_source = "cloud-firestore"
            log_structured(
                "INFO",
                "Recorded comfort feedback to Firestore",
                uid=uid,
                feedback=req.feedback,
                new_offset=new_offset,
                feedback_count=new_count,
            )
        except Exception as exc:
            log_structured("WARNING", "Firestore record_comfort_feedback failed, fallback to local", error=str(exc))

    # ローカルキャッシュ更新
    _LOCAL_CALIBRATION_CACHE[uid] = {
        "personal_clo_offset": new_offset,
        "feedback_count": new_count,
        "updated_at": now_iso,
    }
    _save_local_cache()

    return ComfortFeedbackResponse(
        updated_offset=new_offset,
        feedback_count=new_count,
        message=msg,
        storage_source=storage_source,
    )


def record_worn_outfit_to_firestore(uid: str, item_ids: list[str], total_clo: float, location: str = "") -> str:
    """着用確定されたコーディネートを Firestore またはローカルログに記録する。"""
    now_iso = datetime.now(timezone.utc).isoformat()
    db = _get_firestore_client()
    if db is not None:
        try:
            user_ref = db.collection("users").document(uid)
            user_ref.collection("wear_history").add(
                {
                    "item_ids": item_ids,
                    "total_clo": total_clo,
                    "location": location,
                    "worn_at": now_iso,
                }
            )
            log_structured("INFO", "Recorded worn outfit to Firestore", uid=uid, total_clo=total_clo)
            return "cloud-firestore"
        except Exception as exc:
            log_structured("WARNING", "Firestore record_worn_outfit failed", error=str(exc))

    return "local-cache"

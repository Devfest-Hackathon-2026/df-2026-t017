import json
import sys
from datetime import datetime, timezone
from typing import Any


def log_structured(
    severity: str,
    message: str,
    event_type: str = "application",
    trace_id: str | None = None,
    **kwargs: Any,
) -> None:
    """Google Cloud Logging 互換の構造化JSONログを標準出力へ書き出す。"""
    payload: dict[str, Any] = {
        "severity": severity.upper(),
        "message": message,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "component": "closet-me-engine",
        "event_type": event_type,
        **kwargs,
    }
    if trace_id:
        payload["logging.googleapis.com/trace"] = trace_id
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()

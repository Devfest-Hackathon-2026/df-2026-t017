from dataclasses import dataclass
from fastapi import Header, HTTPException, status

from app.core.config import settings
from app.core.logging import log_structured


@dataclass
class AuthContext:
    uid: str
    is_demo: bool


_firebase_initialized = False


def _ensure_firebase() -> None:
    global _firebase_initialized
    if _firebase_initialized:
        return
    import firebase_admin

    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    _firebase_initialized = True


async def get_auth_context(
    authorization: str | None = Header(default=None),
    x_demo_mode: str | None = Header(default=None),
) -> AuthContext:
    """
    Firebase Authentication の ID Token をサーバーサイド検証する。
    審査員・ローカル検証用に明示的な X-Demo-Mode: true ヘッダー時は隔離された demo-user コンテキストを返す。
    """
    if x_demo_mode and x_demo_mode.lower() == "true":
        return AuthContext(uid="demo-user", is_demo=True)

    if not authorization or not authorization.startswith("Bearer "):
        if not settings.enable_firestore:
            return AuthContext(uid="demo-user", is_demo=True)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization Bearer token.",
        )

    token = authorization.removeprefix("Bearer ").strip()
    try:
        _ensure_firebase()
        from firebase_admin import auth

        decoded = auth.verify_id_token(token)
        return AuthContext(uid=decoded["uid"], is_demo=False)
    except Exception as exc:
        log_structured("WARNING", "Firebase ID token verification failed", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Firebase ID token.",
        ) from exc

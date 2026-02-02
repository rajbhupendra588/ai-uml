"""
GitHub OAuth: redirect, callback, session store, and helpers.
Uses in-memory session store and signed cookie for session_id.
"""
import logging
import os
import secrets
from urllib.parse import urlencode

import httpx
from itsdangerous import BadSignature, URLSafeTimedSerializer

from config import (
    FRONTEND_URL,
    GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET,
    SECRET_KEY,
)

logger = logging.getLogger("architectai.auth")

COOKIE_NAME = "architectai_session"
COOKIE_MAX_AGE = 30 * 24 * 3600  # 30 days
SERIALIZER = URLSafeTimedSerializer(SECRET_KEY, salt="architectai-session")

# session_id -> {"access_token": str, "login": str}
_sessions: dict[str, dict] = {}


def is_github_oauth_configured() -> bool:
    return bool(GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET)


def get_github_authorize_url(redirect_uri: str) -> str:
    params = {
        "client_id": GITHUB_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "scope": "read:user user:email repo",
        "state": secrets.token_urlsafe(32),
    }
    return "https://github.com/login/oauth/authorize?" + urlencode(params)


async def exchange_code_for_token(code: str, redirect_uri: str) -> dict:
    async with httpx.AsyncClient() as client:
        r = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": redirect_uri,
            },
            timeout=10.0,
        )
        r.raise_for_status()
        return r.json()


def get_user_login(access_token: str) -> str | None:
    with httpx.Client() as client:
        r = client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {access_token}", "Accept": "application/vnd.github.v3+json"},
            timeout=10.0,
        )
        if r.status_code != 200:
            return None
        data = r.json()
        return data.get("login") or data.get("name") or "user"


def create_session(access_token: str) -> str:
    login = get_user_login(access_token) or "user"
    session_id = secrets.token_urlsafe(32)
    _sessions[session_id] = {"access_token": access_token, "login": login}
    return session_id


def get_session_from_cookie(cookie_value: str | None) -> dict | None:
    if not cookie_value:
        return None
    try:
        session_id = SERIALIZER.loads(cookie_value, max_age=COOKIE_MAX_AGE)
    except BadSignature:
        return None
    return _sessions.get(session_id)


def sign_session_id(session_id: str) -> str:
    return SERIALIZER.dumps(session_id)


def destroy_session(session_id: str) -> None:
    _sessions.pop(session_id, None)


def get_access_token_from_cookie(cookie_value: str | None) -> str | None:
    sess = get_session_from_cookie(cookie_value)
    if not sess:
        return None
    return sess.get("access_token")


def get_login_from_cookie(cookie_value: str | None) -> str | None:
    sess = get_session_from_cookie(cookie_value)
    if not sess:
        return None
    return sess.get("login")


def get_session_from_token(token_value: str | None) -> dict | None:
    """Validate signed session token (e.g. from X-Session-Token header for cross-origin)."""
    if not token_value:
        return None
    try:
        session_id = SERIALIZER.loads(token_value, max_age=COOKIE_MAX_AGE)
    except BadSignature:
        return None
    return _sessions.get(session_id)


def get_access_token_from_request(cookie_value: str | None, header_token: str | None) -> str | None:
    sess = get_session_from_cookie(cookie_value) or get_session_from_token(header_token)
    if not sess:
        return None
    return sess.get("access_token")


def get_login_from_request(cookie_value: str | None, header_token: str | None) -> str | None:
    sess = get_session_from_cookie(cookie_value) or get_session_from_token(header_token)
    if not sess:
        return None
    return sess.get("login")

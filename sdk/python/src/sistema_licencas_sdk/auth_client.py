from __future__ import annotations

import time
import webbrowser
from dataclasses import dataclass
from typing import Any

import httpx

from .browser_login import (
    LoopbackCallbackServer,
    build_authorization_url,
    create_s256_code_challenge,
    generate_code_verifier,
    generate_nonce,
    generate_state,
)
from .errors import AccessPendingError, ApiProblemError
from .offline_validator import OfflineLoginResult, OfflineSessionValidator
from .storage import KeyringSessionStorage, SessionStorage


@dataclass
class AuthClient:
    base_url: str
    program_id: str
    storage: SessionStorage | None = None
    timeout_seconds: float = 10.0

    def __post_init__(self) -> None:
        self.base_url = self.base_url.rstrip("/")
        if self.storage is None:
            self.storage = KeyringSessionStorage(
                account_name=f"{self.program_id}-session",
            )
        self.validator = OfflineSessionValidator()

    def login(
        self,
        *,
        device_fingerprint: dict[str, str],
    ) -> dict[str, Any]:
        return self.login_with_browser(device_fingerprint=device_fingerprint)

    def login_with_browser(
        self,
        *,
        device_fingerprint: dict[str, str],
        callback_timeout_seconds: float = 180.0,
        loopback_host: str = "127.0.0.1",
        loopback_port: int = 53123,
        callback_path: str = "/callback",
        auto_open_browser: bool = True,
    ) -> dict[str, Any]:
        oidc_config = self._request("GET", "/api/v2/auth/oidc/config")
        state = generate_state()
        nonce = generate_nonce()
        code_verifier = generate_code_verifier()
        code_challenge = create_s256_code_challenge(code_verifier)

        with LoopbackCallbackServer(
            host=loopback_host,
            port=loopback_port,
            path=callback_path,
            timeout_seconds=callback_timeout_seconds,
        ) as callback_server:
            authorization_url = build_authorization_url(
                authorization_endpoint=oidc_config["authorization_endpoint"],
                client_id=oidc_config["client_id"],
                redirect_uri=callback_server.redirect_uri,
                scopes=list(oidc_config.get("scopes") or ["openid", "profile", "email"]),
                state=state,
                nonce=nonce,
                code_challenge=code_challenge,
            )

            if auto_open_browser:
                opened = webbrowser.open(authorization_url, new=1, autoraise=True)
                if not opened:
                    raise RuntimeError(
                        f"Unable to open browser automatically. Open this URL manually: {authorization_url}"
                    )
            else:
                raise RuntimeError(f"Open this URL manually: {authorization_url}")

            callback = callback_server.wait_for_callback(expected_state=state)
            return self.login_with_authorization_code(
                authorization_code=callback.code,
                code_verifier=code_verifier,
                redirect_uri=callback_server.redirect_uri,
                nonce=nonce,
                device_fingerprint=device_fingerprint,
            )

    def login_with_authorization_code(
        self,
        *,
        authorization_code: str,
        code_verifier: str,
        redirect_uri: str,
        nonce: str,
        device_fingerprint: dict[str, str],
    ) -> dict[str, Any]:
        payload = {
            "authorization_code": authorization_code,
            "code_verifier": code_verifier,
            "redirect_uri": redirect_uri,
            "nonce": nonce,
            "device_fingerprint": {"raw_components": device_fingerprint},
        }

        response = self._request("POST", "/api/v2/auth/login", json=payload)
        jwks = self._request("GET", "/.well-known/jwks.json")

        identifier = "unknown"
        self._save_session(response, jwks, identifier)
        return response

    def refresh(self, *, device_fingerprint: dict[str, str]) -> dict[str, Any]:
        session = self.load_session()
        if not session:
            raise RuntimeError("No active session found")

        payload = {
            "refresh_token": session["refresh_token"],
            "device_fingerprint": {"raw_components": device_fingerprint},
        }

        response = self._request("POST", "/api/v2/auth/refresh", json=payload)
        jwks = self._request("GET", "/.well-known/jwks.json")
        self._save_session(response, jwks, session.get("identifier", "unknown"))
        return response

    def logout(self) -> dict[str, Any]:
        session = self.load_session()
        if not session:
            return {"success": True}

        payload = {
            "refresh_token": session["refresh_token"],
        }
        response = self._request("POST", "/api/v2/auth/logout", json=payload)
        self._require_storage().clear()
        return response

    def whoami(self) -> dict[str, Any]:
        session = self.load_session()
        if not session:
            raise RuntimeError("No active session found")

        return self._request(
            "GET",
            "/api/v2/auth/me",
            headers={"Authorization": f"Bearer {session['access_token']}"},
        )

    def can_login_offline(self, *, device_fingerprint: dict[str, str]) -> OfflineLoginResult:
        session = self.load_session()
        result = self.validator.can_login_offline(session, device_fingerprint)

        if session:
            session["last_wall_clock_ms"] = int(time.time() * 1000)
            self._require_storage().save(session)

        return result

    def load_session(self) -> dict[str, Any] | None:
        return self._require_storage().load()

    def _save_session(self, auth_response: dict[str, Any], jwks: dict[str, Any], identifier: str) -> None:
        now_wall_clock_ms = int(time.time() * 1000)
        self._require_storage().save(
            {
                "identifier": identifier,
                "program_id": self.program_id,
                "access_token": auth_response["access_token"],
                "access_expires_at": auth_response["access_expires_at"],
                "refresh_token": auth_response["refresh_token"],
                "refresh_expires_at": auth_response["refresh_expires_at"],
                "offline_token": auth_response["offline_token"],
                "offline_expires_at": auth_response["offline_expires_at"],
                "max_offline_hours": auth_response["max_offline_hours"],
                "entitlements": auth_response.get("entitlements")
                or ([auth_response.get("entitlement")] if auth_response.get("entitlement") else []),
                "jwks": jwks,
                "anchor_server_time_ms": int(auth_response["server_time_ms"]),
                "anchor_monotonic_ns": time.monotonic_ns(),
                "last_wall_clock_ms": now_wall_clock_ms,
            }
        )

    def _request(
        self,
        method: str,
        path: str,
        *,
        json: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        request_headers = {
            "X-Program-Id": self.program_id,
            "Accept": "application/json",
        }
        if headers:
            request_headers.update(headers)

        with httpx.Client(timeout=self.timeout_seconds) as client:
            response = client.request(
                method,
                f"{self.base_url}{path}",
                json=json,
                headers=request_headers,
            )

        if response.status_code >= 400:
            try:
                payload = response.json()
            except ValueError:
                payload = {}

            title = "Request failed"
            if response.reason_phrase:
                title = response.reason_phrase
            if isinstance(payload, dict) and isinstance(payload.get("title"), str):
                title = payload["title"]
            code = payload.get("code") if isinstance(payload, dict) and isinstance(payload.get("code"), str) else None
            detail = None
            if isinstance(payload, dict):
                if isinstance(payload.get("detail"), str):
                    detail = payload["detail"]
                elif isinstance(payload.get("message"), str):
                    detail = payload["message"]
            if detail is None:
                text = response.text.strip()
                detail = text or None

            if code == "access_pending":
                raise AccessPendingError(
                    status=response.status_code,
                    title=title,
                    detail=detail,
                    code=code,
                )

            raise ApiProblemError(
                status=response.status_code,
                title=title,
                detail=detail,
                code=code,
            )

        return response.json()

    def _require_storage(self) -> SessionStorage:
        storage = self.storage
        if storage is None:
            raise RuntimeError("Session storage is not configured")
        return storage

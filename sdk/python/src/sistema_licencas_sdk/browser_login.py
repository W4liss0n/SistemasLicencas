from __future__ import annotations

import base64
import hashlib
import secrets
import time
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any
from urllib.parse import parse_qs, urlencode, urlparse


def _base64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def generate_state() -> str:
    return secrets.token_urlsafe(24)


def generate_nonce() -> str:
    return secrets.token_urlsafe(24)


def generate_code_verifier() -> str:
    # RFC 7636 allows 43-128 chars from unreserved charset.
    return secrets.token_urlsafe(64)[:96]


def create_s256_code_challenge(code_verifier: str) -> str:
    digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
    return _base64url(digest)


def build_authorization_url(
    *,
    authorization_endpoint: str,
    client_id: str,
    redirect_uri: str,
    scopes: list[str],
    state: str,
    nonce: str,
    code_challenge: str,
) -> str:
    params = {
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "scope": " ".join(scopes),
        "state": state,
        "nonce": nonce,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
    }
    separator = "&" if "?" in authorization_endpoint else "?"
    return f"{authorization_endpoint}{separator}{urlencode(params)}"


@dataclass
class AuthorizationCallback:
    code: str
    state: str


class LoopbackCallbackServer:
    def __init__(
        self,
        *,
        host: str = "127.0.0.1",
        port: int = 0,
        path: str = "/callback",
        timeout_seconds: float = 180.0,
    ) -> None:
        self.host = host
        self.port = port
        self.path = path
        self.timeout_seconds = timeout_seconds
        self._payload: dict[str, str] | None = None

        server = self

        class CallbackHandler(BaseHTTPRequestHandler):
            def do_GET(self) -> None:  # noqa: N802
                parsed = urlparse(self.path)
                if parsed.path != server.path:
                    self.send_response(404)
                    self.end_headers()
                    return

                params = {
                    key: values[0]
                    for key, values in parse_qs(parsed.query, keep_blank_values=False).items()
                    if values
                }
                server._payload = params

                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.end_headers()
                self.wfile.write(
                    (
                        "<html><body><h3>Login concluido.</h3>"
                        "<p>Voce pode fechar esta janela e voltar ao app.</p></body></html>"
                    ).encode("utf-8")
                )

            def log_message(self, format: str, *args: Any) -> None:  # noqa: A003
                return

        self._httpd = HTTPServer((self.host, self.port), CallbackHandler)
        self._httpd.timeout = 0.5

    @property
    def redirect_uri(self) -> str:
        host, port = self._httpd.server_address
        return f"http://{host}:{port}{self.path}"

    def wait_for_callback(self, *, expected_state: str) -> AuthorizationCallback:
        deadline = time.time() + self.timeout_seconds
        while time.time() < deadline:
            self._httpd.handle_request()
            if not self._payload:
                continue

            callback_state = self._payload.get("state", "")
            if callback_state != expected_state:
                raise RuntimeError("OIDC callback state mismatch")

            code = self._payload.get("code", "")
            if not code:
                error = self._payload.get("error", "unknown_error")
                raise RuntimeError(f"OIDC callback failed: {error}")

            return AuthorizationCallback(code=code, state=callback_state)

        raise RuntimeError("OIDC callback timeout")

    def close(self) -> None:
        self._httpd.server_close()

    def __enter__(self) -> "LoopbackCallbackServer":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:  # type: ignore[no-untyped-def]
        self.close()

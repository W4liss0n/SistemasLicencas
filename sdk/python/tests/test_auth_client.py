from __future__ import annotations

from pathlib import Path

import httpx
import pytest

from sistema_licencas_sdk.auth_client import AuthClient
from sistema_licencas_sdk.errors import AccessPendingError, ApiProblemError
from sistema_licencas_sdk.storage import FileSessionStorage


def _build_response(method: str, url: str, *, status_code: int, payload: dict[str, object]) -> httpx.Response:
    request = httpx.Request(method, url)
    return httpx.Response(status_code, json=payload, request=request)


class _FakeClient:
    def __init__(self, responses: dict[tuple[str, str], httpx.Response]) -> None:
        self.responses = responses

    def __enter__(self) -> _FakeClient:
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        return False

    def request(
        self,
        method: str,
        url: str,
        *,
        json: dict[str, object] | None = None,
        headers: dict[str, str] | None = None,
    ) -> httpx.Response:
        del json, headers
        return self.responses[(method, url)]


def _client(tmp_path: Path) -> AuthClient:
    return AuthClient(
        base_url="https://example.test",
        program_id="demo-program",
        storage=FileSessionStorage(path=str(tmp_path / "session.json")),
    )


def test_login_does_not_persist_session_when_access_is_pending(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    responses = {
        (
            "POST",
            "https://example.test/api/v2/auth/login",
        ): _build_response(
            "POST",
            "https://example.test/api/v2/auth/login",
            status_code=403,
            payload={
                "title": "Access pending",
                "status": 403,
                "code": "access_pending",
                "detail": "User account is awaiting plan assignment",
            },
        )
    }
    monkeypatch.setattr(httpx, "Client", lambda timeout: _FakeClient(responses))

    client = _client(tmp_path)

    with pytest.raises(AccessPendingError) as error:
        client.login_with_authorization_code(
            authorization_code="code-123",
            code_verifier="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890-._~",
            redirect_uri="http://127.0.0.1:53123/callback",
            nonce="nonce-12345",
            device_fingerprint={"machine_id": "MACHINE-A", "disk_serial": "DISK-A"},
        )

    assert error.value.code == "access_pending"
    assert client.load_session() is None


def test_login_maps_other_problem_responses_to_generic_api_error(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    responses = {
        (
            "POST",
            "https://example.test/api/v2/auth/login",
        ): _build_response(
            "POST",
            "https://example.test/api/v2/auth/login",
            status_code=403,
            payload={
                "title": "User blocked",
                "status": 403,
                "code": "user_blocked",
                "detail": "User is blocked",
            },
        )
    }
    monkeypatch.setattr(httpx, "Client", lambda timeout: _FakeClient(responses))

    client = _client(tmp_path)

    with pytest.raises(ApiProblemError) as error:
        client.login_with_authorization_code(
            authorization_code="code-123",
            code_verifier="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890-._~",
            redirect_uri="http://127.0.0.1:53123/callback",
            nonce="nonce-12345",
            device_fingerprint={"machine_id": "MACHINE-A", "disk_serial": "DISK-A"},
        )

    assert error.value.code == "user_blocked"
    assert "user_blocked" in str(error.value)
    assert client.load_session() is None

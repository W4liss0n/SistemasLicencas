from __future__ import annotations

import os
import uuid
from pathlib import Path

import pytest

from sistema_licencas_sdk.auth_client import AuthClient
from sistema_licencas_sdk.storage import FileSessionStorage

pytestmark = pytest.mark.integration


def _required_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        pytest.skip(f"{name} is not set")
    return value


def _fingerprint() -> dict[str, str]:
    return {
        "machine_id": "CI-MACHINE",
        "disk_serial": "CI-DISK",
        "mac_address": "AA:BB:CC:DD:EE:01",
    }


def test_auth_flow_login_refresh_whoami_logout(tmp_path: Path) -> None:
    base_url = _required_env("SDK_INTEGRATION_BASE_URL")
    program_id = os.getenv("SDK_INTEGRATION_PROGRAM_ID", "demo-program")
    identifier = os.getenv("SDK_INTEGRATION_IDENTIFIER", "user.demo@example.com")
    authorization_code = _required_env("SDK_INTEGRATION_AUTHORIZATION_CODE")
    code_verifier = _required_env("SDK_INTEGRATION_CODE_VERIFIER")
    redirect_uri = _required_env("SDK_INTEGRATION_REDIRECT_URI")
    nonce = _required_env("SDK_INTEGRATION_NONCE")

    session_file = tmp_path / f"session-{uuid.uuid4()}.json"
    client = AuthClient(
        base_url=base_url,
        program_id=program_id,
        storage=FileSessionStorage(path=str(session_file)),
    )

    login = client.login_with_authorization_code(
        authorization_code=authorization_code,
        code_verifier=code_verifier,
        redirect_uri=redirect_uri,
        nonce=nonce,
        device_fingerprint=_fingerprint(),
    )
    assert login["access_token"]
    assert login["refresh_token"]
    assert login["offline_token"]
    assert isinstance(login.get("entitlements"), list)
    assert len(login["entitlements"]) >= 1

    whoami = client.whoami()
    assert whoami["success"] is True
    assert whoami["user"]["identifier"] == identifier

    refreshed = client.refresh(device_fingerprint=_fingerprint())
    assert refreshed["success"] is True
    assert refreshed["access_token"]
    assert refreshed["refresh_token"]

    logout = client.logout()
    assert logout["success"] is True
    assert client.load_session() is None


def test_blocked_user_login_is_rejected(tmp_path: Path) -> None:
    base_url = _required_env("SDK_INTEGRATION_BASE_URL")
    program_id = os.getenv("SDK_INTEGRATION_PROGRAM_ID", "demo-program")
    blocked_code = _required_env("SDK_INTEGRATION_BLOCKED_AUTHORIZATION_CODE")
    blocked_code_verifier = _required_env("SDK_INTEGRATION_BLOCKED_CODE_VERIFIER")
    blocked_redirect_uri = _required_env("SDK_INTEGRATION_BLOCKED_REDIRECT_URI")
    blocked_nonce = _required_env("SDK_INTEGRATION_BLOCKED_NONCE")

    session_file = tmp_path / f"session-{uuid.uuid4()}.json"
    client = AuthClient(
        base_url=base_url,
        program_id=program_id,
        storage=FileSessionStorage(path=str(session_file)),
    )

    with pytest.raises(RuntimeError) as error:
        client.login_with_authorization_code(
            authorization_code=blocked_code,
            code_verifier=blocked_code_verifier,
            redirect_uri=blocked_redirect_uri,
            nonce=blocked_nonce,
            device_fingerprint=_fingerprint(),
        )

    assert "user_blocked" in str(error.value)

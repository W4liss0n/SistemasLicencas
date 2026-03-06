from __future__ import annotations

import base64
import hashlib
import json
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse

import httpx

from sistema_licencas_sdk.auth_client import AuthClient
from sistema_licencas_sdk.storage import FileSessionStorage


def _create_code_challenge(code_verifier: str) -> str:
    digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")


def main() -> None:
    storage_path = Path(".tmp") / "browser-login-headless-session.json"
    storage_path.parent.mkdir(parents=True, exist_ok=True)

    client = AuthClient(
        base_url="http://127.0.0.1:3001",
        program_id="demo-program",
        storage=FileSessionStorage(storage_path),
    )

    fingerprint = {
        "machine_id": "MACHINE-A",
        "disk_serial": "DISK-A",
        "mac_address": "AA:BB:CC:DD:EE:01",
    }

    oidc = client._request("GET", "/api/v2/auth/oidc/config")

    redirect_uri = "http://127.0.0.1:53123/callback"
    state = "headless-state-123"
    nonce = "headless-nonce-123"
    code_verifier = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890-._~"
    code_challenge = _create_code_challenge(code_verifier)

    query = urlencode(
        {
            "response_type": "code",
            "client_id": oidc["client_id"],
            "redirect_uri": redirect_uri,
            "scope": " ".join(oidc.get("scopes", ["openid", "profile", "email"])),
            "state": state,
            "nonce": nonce,
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
        }
    )
    authorize_url = f"{oidc['authorization_endpoint']}?{query}"

    with httpx.Client(follow_redirects=False, timeout=10.0) as http_client:
        response = http_client.get(authorize_url)

    if response.status_code not in (301, 302):
        raise RuntimeError(f"Unexpected authorize response: {response.status_code} {response.text}")

    location = response.headers.get("location")
    if not location:
        raise RuntimeError("Authorize response did not return Location header")

    parsed = urlparse(location)
    params = parse_qs(parsed.query)
    code = (params.get("code") or [""])[0]
    if not code:
        raise RuntimeError(f"Authorize response does not contain code: {location}")

    session = client.login_with_authorization_code(
        authorization_code=code,
        code_verifier=code_verifier,
        redirect_uri=redirect_uri,
        nonce=nonce,
        device_fingerprint=fingerprint,
    )
    print("[headless-smoke] login success:", session.get("success"))

    whoami = client.whoami()
    print("[headless-smoke] whoami:", json.dumps(whoami, indent=2))

    offline = client.can_login_offline(device_fingerprint=fingerprint)
    print("[headless-smoke] offline check:", offline.allowed, offline.reason)


if __name__ == "__main__":
    main()

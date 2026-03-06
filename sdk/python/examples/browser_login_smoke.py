from __future__ import annotations

import json
from pathlib import Path

from sistema_licencas_sdk.auth_client import AuthClient
from sistema_licencas_sdk.storage import FileSessionStorage


def main() -> None:
    storage_path = Path(".tmp") / "browser-login-smoke-session.json"
    storage_path.parent.mkdir(parents=True, exist_ok=True)
    loopback_port = 53123

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

    session = client.login_with_browser(
        device_fingerprint=fingerprint,
        loopback_port=loopback_port,
    )
    print("[smoke] login success:", session.get("success"))
    print(
        "[smoke] token expirations:",
        session.get("access_expires_at"),
        session.get("refresh_expires_at"),
        session.get("offline_expires_at"),
    )

    whoami = client.whoami()
    print("[smoke] whoami:", json.dumps(whoami, indent=2))

    offline = client.can_login_offline(device_fingerprint=fingerprint)
    print("[smoke] offline check:", offline.allowed, offline.reason)


if __name__ == "__main__":
    main()

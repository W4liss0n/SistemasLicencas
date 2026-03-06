from __future__ import annotations

import time

from authlib.jose import JsonWebKey, JsonWebToken

from sistema_licencas_sdk.offline_validator import OfflineSessionValidator


def _build_offline_session(device_fingerprint: dict[str, str]) -> dict[str, object]:
    validator = OfflineSessionValidator()
    fp_hash = validator.compute_fingerprint_hash(device_fingerprint)

    private_key = JsonWebKey.generate_key("RSA", 2048, is_private=True, options={"kid": "test-key"})
    public_key = private_key.as_dict(is_private=False)
    public_key["kid"] = "test-key"

    now_s = int(time.time())
    token = JsonWebToken(["RS256"]).encode(
        {"alg": "RS256", "kid": "test-key", "typ": "JWT"},
        {
            "sub": "user-1",
            "sid": "session-1",
            "program_id": "program-1",
            "fp_hash": fp_hash,
            "exp": now_s + 3600,
            "nbf": now_s - 5,
            "iat": now_s,
        },
        private_key,
    )

    return {
        "offline_token": token.decode("utf-8") if isinstance(token, bytes) else token,
        "jwks": {"keys": [public_key]},
        "anchor_server_time_ms": now_s * 1000,
        "anchor_monotonic_ns": time.monotonic_ns(),
        "last_wall_clock_ms": int(time.time() * 1000),
    }


def test_compute_fingerprint_hash_is_deterministic() -> None:
    validator = OfflineSessionValidator()
    fingerprint = {"machine_id": "A", "disk_serial": "B"}

    first = validator.compute_fingerprint_hash(fingerprint)
    second = validator.compute_fingerprint_hash({"disk_serial": "B", "machine_id": "A"})

    assert first == second
    assert first.startswith("sha256:")


def test_can_login_offline_success() -> None:
    validator = OfflineSessionValidator(clock_skew_seconds=120)
    fingerprint = {"machine_id": "A", "disk_serial": "B"}
    session = _build_offline_session(fingerprint)

    result = validator.can_login_offline(session, fingerprint)

    assert result.allowed is True
    assert result.reason is None


def test_can_login_offline_blocks_on_clock_tamper() -> None:
    validator = OfflineSessionValidator(clock_skew_seconds=120)
    fingerprint = {"machine_id": "A", "disk_serial": "B"}
    session = _build_offline_session(fingerprint)
    session["last_wall_clock_ms"] = int(time.time() * 1000) + (10 * 60 * 1000)

    result = validator.can_login_offline(session, fingerprint)

    assert result.allowed is False
    assert result.reason == "clock_tamper_detected"


def test_can_login_offline_fails_after_expiration_window() -> None:
    validator = OfflineSessionValidator(clock_skew_seconds=120)
    fingerprint = {"machine_id": "A", "disk_serial": "B"}
    session = _build_offline_session(fingerprint)
    session["anchor_server_time_ms"] = (int(time.time()) - 8000) * 1000

    result = validator.can_login_offline(session, fingerprint)

    assert result.allowed is False
    assert result.reason == "offline_not_allowed"


def test_can_login_offline_fails_with_fingerprint_mismatch() -> None:
    validator = OfflineSessionValidator(clock_skew_seconds=120)
    fingerprint = {"machine_id": "A", "disk_serial": "B"}
    session = _build_offline_session(fingerprint)

    result = validator.can_login_offline(
        session,
        {"machine_id": "A", "disk_serial": "DIFFERENT"},
    )

    assert result.allowed is False
    assert result.reason == "offline_not_allowed"

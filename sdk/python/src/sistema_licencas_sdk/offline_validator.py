from __future__ import annotations

import hashlib
import time
from dataclasses import dataclass
from typing import Any

from authlib.jose import JsonWebKey, JsonWebToken


@dataclass
class OfflineLoginResult:
    allowed: bool
    reason: str | None = None
    claims: dict[str, Any] | None = None


class OfflineSessionValidator:
    def __init__(self, clock_skew_seconds: int = 120) -> None:
        self.clock_skew_seconds = clock_skew_seconds
        self._jwt = JsonWebToken(["RS256"])

    def can_login_offline(
        self,
        session: dict[str, Any] | None,
        device_fingerprint: dict[str, str],
    ) -> OfflineLoginResult:
        if not session:
            return OfflineLoginResult(allowed=False, reason="offline_not_allowed")

        required_fields = [
            "offline_token",
            "jwks",
            "anchor_server_time_ms",
            "anchor_monotonic_ns",
            "last_wall_clock_ms",
        ]
        if any(field not in session for field in required_fields):
            return OfflineLoginResult(allowed=False, reason="offline_not_allowed")

        now_wall_clock_ms = int(time.time() * 1000)
        skew_ms = self.clock_skew_seconds * 1000

        # Detect backward wall-clock movement beyond configured tolerance.
        if now_wall_clock_ms + skew_ms < int(session["last_wall_clock_ms"]):
            return OfflineLoginResult(allowed=False, reason="clock_tamper_detected")

        elapsed_monotonic_ms = max(
            0,
            (time.monotonic_ns() - int(session["anchor_monotonic_ns"])) // 1_000_000,
        )
        estimated_server_now_ms = int(session["anchor_server_time_ms"]) + elapsed_monotonic_ms
        estimated_server_now_s = estimated_server_now_ms // 1000

        try:
            key_set = JsonWebKey.import_key_set(session["jwks"])
            claims = self._jwt.decode(session["offline_token"], key_set)
        except Exception:
            return OfflineLoginResult(allowed=False, reason="offline_not_allowed")

        token_exp = int(claims.get("exp", 0))
        token_nbf = int(claims.get("nbf", 0))

        if token_exp and (estimated_server_now_s - self.clock_skew_seconds) > token_exp:
            return OfflineLoginResult(allowed=False, reason="offline_not_allowed")

        if token_nbf and (estimated_server_now_s + self.clock_skew_seconds) < token_nbf:
            return OfflineLoginResult(allowed=False, reason="offline_not_allowed")

        expected_fp_hash = self.compute_fingerprint_hash(device_fingerprint)
        if claims.get("fp_hash") != expected_fp_hash:
            return OfflineLoginResult(allowed=False, reason="offline_not_allowed")

        return OfflineLoginResult(allowed=True, claims=dict(claims))

    @staticmethod
    def compute_fingerprint_hash(raw_components: dict[str, str]) -> str:
        normalized = sorted(
            (str(key).strip().lower(), str(value).strip())
            for key, value in raw_components.items()
            if str(key).strip() and str(value).strip()
        )
        canonical = "|".join(f"{key}:{value}" for key, value in normalized)
        digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
        return f"sha256:{digest}"

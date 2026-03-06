from __future__ import annotations

from urllib.parse import parse_qs, urlparse

from sistema_licencas_sdk.browser_login import (
    build_authorization_url,
    create_s256_code_challenge,
    generate_code_verifier,
)


def test_generate_code_verifier_respects_pkce_minimum_length() -> None:
    verifier = generate_code_verifier()
    assert len(verifier) >= 43


def test_create_s256_code_challenge_is_stable() -> None:
    verifier = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890-._~"
    challenge = create_s256_code_challenge(verifier)
    assert challenge == "5SSChZEuBRNr4SW163AsWSLl4fRLU51M5eCoRi65P-8"


def test_build_authorization_url_contains_pkce_nonce_and_state() -> None:
    url = build_authorization_url(
        authorization_endpoint="https://issuer.example.com/authorize",
        client_id="launcher-client",
        redirect_uri="http://127.0.0.1:53123/callback",
        scopes=["openid", "profile", "email"],
        state="state-123",
        nonce="nonce-123",
        code_challenge="challenge-xyz",
    )

    parsed = urlparse(url)
    query = parse_qs(parsed.query)
    assert parsed.scheme == "https"
    assert query["client_id"] == ["launcher-client"]
    assert query["redirect_uri"] == ["http://127.0.0.1:53123/callback"]
    assert query["scope"] == ["openid profile email"]
    assert query["state"] == ["state-123"]
    assert query["nonce"] == ["nonce-123"]
    assert query["code_challenge"] == ["challenge-xyz"]
    assert query["code_challenge_method"] == ["S256"]

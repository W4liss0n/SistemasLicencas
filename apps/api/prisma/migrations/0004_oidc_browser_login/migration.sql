ALTER TABLE end_users
    ADD COLUMN oidc_issuer VARCHAR(255),
    ADD COLUMN oidc_subject VARCHAR(255),
    ADD COLUMN email_verified_at TIMESTAMPTZ;

CREATE UNIQUE INDEX uq_end_users_oidc_identity
ON end_users(oidc_issuer, oidc_subject);

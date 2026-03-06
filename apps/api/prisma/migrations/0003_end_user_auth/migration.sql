CREATE TYPE end_user_status AS ENUM ('active', 'blocked');

CREATE TABLE end_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    identifier VARCHAR(255) NOT NULL,
    password_hash VARCHAR(512) NOT NULL,
    password_salt VARCHAR(255) NOT NULL,
    hash_version VARCHAR(32) NOT NULL DEFAULT 'scrypt_v1',
    status end_user_status NOT NULL DEFAULT 'active',
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_end_users_customer_identifier UNIQUE (customer_id, identifier)
);

CREATE INDEX idx_end_users_identifier ON end_users(identifier);

CREATE TABLE end_user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES end_users(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    device_fingerprint_hash VARCHAR(255) NOT NULL,
    refresh_token_hash VARCHAR(128) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    revoke_reason VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_end_user_sessions_lookup
ON end_user_sessions(user_id, program_id, device_fingerprint_hash, revoked_at);

CREATE TABLE auth_audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES end_users(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    ip INET,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_auth_audit_event_type_created
ON auth_audit_events(event_type, created_at DESC);

CREATE INDEX idx_auth_audit_user_created
ON auth_audit_events(user_id, created_at DESC);

CREATE TRIGGER trg_end_users_updated_at
BEFORE UPDATE ON end_users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

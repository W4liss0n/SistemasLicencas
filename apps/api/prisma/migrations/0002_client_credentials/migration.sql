CREATE TABLE client_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    identifier VARCHAR(255) NOT NULL,
    password_hash VARCHAR(512) NOT NULL,
    password_salt VARCHAR(255) NOT NULL,
    hash_version VARCHAR(32) NOT NULL DEFAULT 'scrypt_v1',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_authenticated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_client_credentials_program_identifier UNIQUE (program_id, identifier)
);

CREATE INDEX idx_client_credentials_identifier ON client_credentials(identifier);

CREATE TRIGGER trg_client_credentials_updated_at
BEFORE UPDATE ON client_credentials
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

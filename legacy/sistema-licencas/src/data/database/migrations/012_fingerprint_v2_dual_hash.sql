-- Migration: Fingerprint v2 dual-hash support with alias mapping
-- - Keeps one logical device row in license_devices
-- - Allows extra hashes (v1 fallback, legacy) mapped to the same device

-- 1) Extend license_devices with reconciliation metadata
ALTER TABLE license_devices
ADD COLUMN IF NOT EXISTS reconciled_to_v2_at TIMESTAMP;

ALTER TABLE license_devices
ADD COLUMN IF NOT EXISTS last_match_source VARCHAR(30);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'license_devices_last_match_source_check'
  ) THEN
    ALTER TABLE license_devices
    ADD CONSTRAINT license_devices_last_match_source_check
    CHECK (last_match_source IN ('v2_exact', 'v1_fallback', 'reconciled_components', 'new_registration'));
  END IF;
END $$;

-- 2) Create aliases table for multiple hashes per logical device
CREATE TABLE IF NOT EXISTS license_device_fingerprint_aliases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  license_device_id UUID NOT NULL REFERENCES license_devices(id) ON DELETE CASCADE,
  device_fingerprint_id UUID NOT NULL REFERENCES device_fingerprints(id) ON DELETE CASCADE,
  alias_type VARCHAR(30) NOT NULL,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (license_device_id, device_fingerprint_id),
  CHECK (alias_type IN ('v1_fallback', 'legacy_primary'))
);

-- 3) Performance indexes
CREATE INDEX IF NOT EXISTS idx_ldfa_device
ON license_device_fingerprint_aliases(license_device_id);

CREATE INDEX IF NOT EXISTS idx_ldfa_fingerprint
ON license_device_fingerprint_aliases(device_fingerprint_id);

CREATE INDEX IF NOT EXISTS idx_ldfa_expires
ON license_device_fingerprint_aliases(expires_at);

-- 4) Trigger for updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_license_device_fingerprint_aliases_updated_at'
  ) THEN
    CREATE TRIGGER update_license_device_fingerprint_aliases_updated_at
    BEFORE UPDATE ON license_device_fingerprint_aliases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

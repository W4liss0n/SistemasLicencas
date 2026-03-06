-- Migration: Suporte a múltiplos dispositivos por licença
-- Cada plano define quantos dispositivos podem usar a mesma licença

-- 1. Adicionar max_dispositivos na tabela planos (substitui max_licencas que não faz sentido)
ALTER TABLE planos ADD COLUMN IF NOT EXISTS max_dispositivos INTEGER DEFAULT 1;

-- 2. Criar tabela de relacionamento licença ↔ dispositivos (N:N)
CREATE TABLE IF NOT EXISTS license_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    license_key VARCHAR(255) NOT NULL,
    device_fingerprint_id UUID NOT NULL REFERENCES device_fingerprints(id) ON DELETE CASCADE,
    device_name VARCHAR(255),  -- Nome amigável opcional (ex: "Notebook Dell João")
    is_active BOOLEAN DEFAULT TRUE,
    first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_ip INET,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (license_key) REFERENCES licencas(license_key) ON DELETE CASCADE,
    UNIQUE(license_key, device_fingerprint_id)  -- Não permitir duplicatas
);

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_license_devices_license ON license_devices(license_key);
CREATE INDEX IF NOT EXISTS idx_license_devices_fingerprint ON license_devices(device_fingerprint_id);
CREATE INDEX IF NOT EXISTS idx_license_devices_active ON license_devices(license_key, is_active) WHERE is_active = TRUE;

-- 4. Migrar dados existentes: licencas.device_fingerprint → license_devices
-- Apenas licenças que já têm fingerprint cadastrado
DO $$
DECLARE
    license_record RECORD;
    fingerprint_id UUID;
    fingerprint_hash_value VARCHAR(64);
BEGIN
    FOR license_record IN
        SELECT license_key, device_fingerprint
        FROM licencas
        WHERE device_fingerprint IS NOT NULL
        AND device_fingerprint::text != 'null'
        AND device_fingerprint::text != '{}'
    LOOP
        -- Extrair hash do fingerprint
        fingerprint_hash_value := license_record.device_fingerprint->>'hash';

        IF fingerprint_hash_value IS NOT NULL AND fingerprint_hash_value != '' THEN
            -- Buscar ou criar fingerprint na tabela device_fingerprints
            SELECT id INTO fingerprint_id
            FROM device_fingerprints
            WHERE fingerprint_hash = fingerprint_hash_value;

            IF fingerprint_id IS NULL THEN
                -- Criar novo fingerprint
                INSERT INTO device_fingerprints (fingerprint_hash, components, algorithm_version)
                VALUES (
                    fingerprint_hash_value,
                    license_record.device_fingerprint->'components',
                    COALESCE(license_record.device_fingerprint->>'algorithm', 'weighted_v1')
                )
                RETURNING id INTO fingerprint_id;
            END IF;

            -- Inserir na tabela license_devices (se não existir)
            INSERT INTO license_devices (license_key, device_fingerprint_id, is_active)
            VALUES (license_record.license_key, fingerprint_id, TRUE)
            ON CONFLICT (license_key, device_fingerprint_id) DO NOTHING;
        END IF;
    END LOOP;
END $$;

-- 5. Comentários nas colunas
COMMENT ON COLUMN planos.max_dispositivos IS 'Número máximo de dispositivos que podem usar a mesma licença';
COMMENT ON TABLE license_devices IS 'Relacionamento N:N entre licenças e dispositivos. Permite múltiplos dispositivos por licença conforme o plano.';
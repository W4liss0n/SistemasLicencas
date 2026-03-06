-- Tabela para controlar transferências de licença
CREATE TABLE IF NOT EXISTS license_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    license_key VARCHAR(255) NOT NULL,
    old_fingerprint_hash VARCHAR(64),
    new_fingerprint_hash VARCHAR(64),
    old_device_info JSONB,
    new_device_info JSONB,
    ip_address INET,
    reason VARCHAR(50) CHECK (reason IN ('user_requested', 'admin_reset', 'automatic')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para consultas rápidas
CREATE INDEX idx_license_transfers_key ON license_transfers(license_key);
CREATE INDEX idx_license_transfers_created ON license_transfers(created_at);
CREATE INDEX idx_license_transfers_key_month ON license_transfers(
    license_key,
    DATE_TRUNC('month', created_at)
);

-- Função para contar transferências no mês atual
CREATE OR REPLACE FUNCTION count_monthly_transfers(p_license_key VARCHAR)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)
        FROM license_transfers
        WHERE license_key = p_license_key
        AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
    );
END;
$$ LANGUAGE plpgsql;

-- Adicionar coluna de contador de transferências na tabela de licenças (opcional)
ALTER TABLE licencas ADD COLUMN IF NOT EXISTS transfer_count INTEGER DEFAULT 0;
ALTER TABLE licencas ADD COLUMN IF NOT EXISTS last_transfer_at TIMESTAMP;

-- Comentários para documentação
COMMENT ON TABLE license_transfers IS 'Histórico de transferências de dispositivo das licenças';
COMMENT ON COLUMN license_transfers.reason IS 'Motivo da transferência: user_requested (usuário solicitou), admin_reset (admin resetou), automatic (automática)';
COMMENT ON FUNCTION count_monthly_transfers IS 'Conta quantas transferências uma licença teve no mês atual';
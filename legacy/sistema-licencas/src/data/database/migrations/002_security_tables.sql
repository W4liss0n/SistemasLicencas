-- Tabelas de Segurança do Sistema

-- Fingerprints de Sistema
CREATE TABLE IF NOT EXISTS device_fingerprints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fingerprint_hash VARCHAR(64) UNIQUE NOT NULL,
    components JSONB NOT NULL,
    algorithm_version VARCHAR(10) DEFAULT 'weighted_v1',
    confidence_score DECIMAL(3,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cache de Licenças
CREATE TABLE IF NOT EXISTS cache_sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    license_key VARCHAR(255) NOT NULL,
    device_fingerprint_id UUID REFERENCES device_fingerprints(id),
    ip_address INET,
    cache_version VARCHAR(10),
    sync_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cache_expires_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'success' CHECK (status IN ('success', 'failed', 'suspicious'))
);

-- Localização Geográfica
CREATE TABLE IF NOT EXISTS license_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    license_key VARCHAR(255) NOT NULL,
    ip_address INET,
    country VARCHAR(100),
    city VARCHAR(100),
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Eventos de Segurança
CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    license_key VARCHAR(255),
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
        'time_manipulation', 'file_tampering', 'suspicious_process',
        'multiple_instances', 'impossible_velocity', 'excessive_fingerprints',
        'brute_force', 'blacklisted_ip'
    )),
    severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    risk_score DECIMAL(3,2),
    details JSONB,
    ip_address INET,
    automated_action VARCHAR(30) CHECK (automated_action IN ('none', 'warning', 'temporary_block', 'permanent_block')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Análise Comportamental
CREATE TABLE IF NOT EXISTS behavioral_patterns (
    license_key VARCHAR(255) PRIMARY KEY,
    requests_per_hour DECIMAL(8,2),
    unique_ips_per_day DECIMAL(4,2),
    geographic_diversity DECIMAL(3,2),
    fingerprint_stability DECIMAL(3,2),
    time_pattern_score DECIMAL(3,2),
    failure_rate DECIMAL(3,2),
    vpn_usage_rate DECIMAL(3,2),
    behavioral_score DECIMAL(3,2),
    risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    last_analysis TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    analysis_version VARCHAR(10) DEFAULT 'v1'
);

-- Histórico de Validações
CREATE TABLE IF NOT EXISTS validation_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    license_key VARCHAR(255) NOT NULL,
    validation_result BOOLEAN NOT NULL,
    device_fingerprint_id UUID REFERENCES device_fingerprints(id),
    ip_address INET,
    risk_score DECIMAL(3,2),
    validation_details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Blacklist de IPs
CREATE TABLE IF NOT EXISTS ip_blacklist (
    ip_address INET PRIMARY KEY,
    reason TEXT,
    severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255)
);

-- Whitelist de IPs
CREATE TABLE IF NOT EXISTS ip_whitelist (
    ip_address INET PRIMARY KEY,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255)
);

-- Logs de Auditoria
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    action VARCHAR(50) NOT NULL,
    performed_by UUID,
    ip_address INET,
    user_agent TEXT,
    old_values JSONB,
    new_values JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trigger para atualizar updated_at nas tabelas de segurança
CREATE TRIGGER update_device_fingerprints_updated_at BEFORE UPDATE ON device_fingerprints
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- Índices para otimização de performance

-- Índices principais para consultas frequentes
CREATE INDEX idx_licencas_key_active ON licencas(license_key, status)
    WHERE status = 'ativa';

CREATE INDEX idx_assinaturas_cliente_ativa ON assinaturas(cliente_id, status)
    WHERE status = 'ativa';

CREATE INDEX idx_assinaturas_data_fim ON assinaturas(data_fim)
    WHERE status = 'ativa';

CREATE INDEX idx_licencas_assinatura ON licencas(assinatura_id);

-- CREATE INDEX idx_licencas_programa ON licencas(programa_id); -- REMOVIDO: coluna programa_id foi removida em 002_plano_programas.sql

-- Índices de segurança
CREATE INDEX idx_security_events_recent ON security_events(created_at);

CREATE INDEX idx_security_events_license ON security_events(license_key, created_at);

CREATE INDEX idx_security_events_type ON security_events(event_type, severity);

CREATE INDEX idx_cache_sync_license_recent ON cache_sync_logs(license_key, sync_timestamp);

CREATE INDEX idx_locations_license_recent ON license_locations(license_key, timestamp);

CREATE INDEX idx_validation_history_license ON validation_history(license_key, created_at);

CREATE INDEX idx_validation_history_recent ON validation_history(created_at);

-- Índices para análise comportamental
CREATE INDEX idx_behavioral_risk ON behavioral_patterns(risk_level, last_analysis);

CREATE INDEX idx_behavioral_score ON behavioral_patterns(behavioral_score)
    WHERE behavioral_score > 0.5;

-- Índices para fingerprints
CREATE INDEX idx_fingerprints_hash ON device_fingerprints(fingerprint_hash);

CREATE INDEX idx_fingerprints_recent ON device_fingerprints(created_at);

-- Índices para auditoria
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

CREATE INDEX idx_audit_logs_user ON audit_logs(performed_by, created_at);

CREATE INDEX idx_audit_logs_recent ON audit_logs(created_at);

-- Índices para blacklist/whitelist
CREATE INDEX idx_ip_blacklist_active ON ip_blacklist(ip_address);

-- Índices compostos para queries complexas
CREATE INDEX idx_licencas_composite ON licencas(license_key, status, ultimo_acesso);

CREATE INDEX idx_security_composite ON security_events(license_key, event_type, created_at);

-- Índices para JSONB (GIN indexes)
CREATE INDEX idx_licencas_fingerprint ON licencas USING GIN (device_fingerprint);

CREATE INDEX idx_programas_features ON programas USING GIN (features);

CREATE INDEX idx_planos_features ON planos USING GIN (features);

CREATE INDEX idx_security_details ON security_events USING GIN (details);

CREATE INDEX idx_audit_values ON audit_logs USING GIN (old_values, new_values);

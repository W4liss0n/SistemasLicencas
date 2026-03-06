-- Criação das tabelas principais do sistema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela de Clientes
CREATE TABLE IF NOT EXISTS clientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    telefone VARCHAR(20),
    empresa VARCHAR(255),
    status VARCHAR(20) DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'suspenso')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Programas
CREATE TABLE IF NOT EXISTS programas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    versao VARCHAR(50),
    executable_hash VARCHAR(64),
    features JSONB,
    status VARCHAR(20) DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Planos
CREATE TABLE IF NOT EXISTS planos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    preco DECIMAL(10,2),
    duracao_dias INTEGER,
    max_licencas INTEGER DEFAULT 1,
    max_offline_dias INTEGER DEFAULT 7,
    features JSONB,
    status VARCHAR(20) DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Relacionamento Plano-Programa (N:N)
CREATE TABLE IF NOT EXISTS plano_programas (
    plano_id UUID REFERENCES planos(id) ON DELETE CASCADE,
    programa_id UUID REFERENCES programas(id) ON DELETE CASCADE,
    features_override JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (plano_id, programa_id)
);

-- Tabela de Assinaturas
CREATE TABLE IF NOT EXISTS assinaturas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    plano_id UUID REFERENCES planos(id),
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    auto_renovar BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'ativa' CHECK (status IN ('ativa', 'expirada', 'cancelada', 'suspensa')),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Licenças
CREATE TABLE IF NOT EXISTS licencas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assinatura_id UUID REFERENCES assinaturas(id) ON DELETE CASCADE,
    programa_id UUID REFERENCES programas(id),
    license_key VARCHAR(255) UNIQUE NOT NULL,
    device_fingerprint JSONB,
    status VARCHAR(20) DEFAULT 'ativa' CHECK (status IN ('ativa', 'inativa', 'bloqueada', 'transferida')),
    max_offline_hours INTEGER DEFAULT 168,
    ultimo_acesso TIMESTAMP,
    ultimo_ip INET,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger nas tabelas que têm updated_at
CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON clientes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_programas_updated_at BEFORE UPDATE ON programas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_planos_updated_at BEFORE UPDATE ON planos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assinaturas_updated_at BEFORE UPDATE ON assinaturas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_licencas_updated_at BEFORE UPDATE ON licencas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

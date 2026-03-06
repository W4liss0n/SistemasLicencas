-- Migration: Criar relação N:N entre Planos e Programas
-- Objetivo: Permitir que um plano inclua múltiplos programas (pacotes dinâmicos)

-- Criar tabela de relacionamento N:N entre planos e programas
CREATE TABLE IF NOT EXISTS plano_programas (
    plano_id UUID NOT NULL REFERENCES planos(id) ON DELETE CASCADE,
    programa_id UUID NOT NULL REFERENCES programas(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (plano_id, programa_id)
);

-- Criar índices para melhor performance
CREATE INDEX idx_plano_programas_plano_id ON plano_programas(plano_id);
CREATE INDEX idx_plano_programas_programa_id ON plano_programas(programa_id);

-- Migrar dados existentes (se houver licenças com programa_id)
-- Vamos assumir que cada plano atual tem acesso a todos os programas
DO $$
DECLARE
    plano RECORD;
    programa RECORD;
BEGIN
    -- Para cada plano existente
    FOR plano IN SELECT id FROM planos LOOP
        -- Adicionar todos os programas existentes ao plano
        FOR programa IN SELECT id FROM programas WHERE status = 'ativo' LOOP
            INSERT INTO plano_programas (plano_id, programa_id)
            VALUES (plano.id, programa.id)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END LOOP;
END $$;

-- Remover coluna programa_id da tabela licencas (não mais necessária)
-- Agora a licença dá acesso a todos os programas do plano
ALTER TABLE licencas DROP COLUMN IF EXISTS programa_id;

-- Adicionar constraint para garantir apenas uma licença por assinatura
-- (uma licença vale para todos os programas do plano)
ALTER TABLE licencas
ADD CONSTRAINT unique_licenca_por_assinatura UNIQUE (assinatura_id);

-- Adicionar comentários explicativos
COMMENT ON TABLE plano_programas IS 'Relação N:N entre planos e programas - define quais programas estão incluídos em cada plano';
COMMENT ON COLUMN plano_programas.plano_id IS 'ID do plano que inclui o programa';
COMMENT ON COLUMN plano_programas.programa_id IS 'ID do programa incluído no plano';

-- Criar view útil para visualizar planos com seus programas
CREATE OR REPLACE VIEW v_planos_completos AS
SELECT
    p.id as plano_id,
    p.nome as plano_nome,
    p.descricao as plano_descricao,
    p.preco,
    p.duracao_dias,
    p.max_licencas,
    p.status as plano_status,
    COALESCE(
        json_agg(
            json_build_object(
                'id', prog.id,
                'nome', prog.nome,
                'descricao', prog.descricao,
                'versao', prog.versao
            ) ORDER BY prog.nome
        ) FILTER (WHERE prog.id IS NOT NULL),
        '[]'::json
    ) as programas
FROM planos p
LEFT JOIN plano_programas pp ON p.id = pp.plano_id
LEFT JOIN programas prog ON pp.programa_id = prog.id
GROUP BY p.id, p.nome, p.descricao, p.preco, p.duracao_dias, p.max_licencas, p.status;

-- Criar função para verificar se um programa está incluído em um plano
CREATE OR REPLACE FUNCTION programa_incluso_no_plano(
    p_plano_id UUID,
    p_programa_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM plano_programas
        WHERE plano_id = p_plano_id
        AND programa_id = p_programa_id
    );
END;
$$ LANGUAGE plpgsql;

-- Criar função para validar licença com novo modelo
CREATE OR REPLACE FUNCTION validar_licenca_programa(
    p_license_key VARCHAR(255),
    p_programa_id UUID
) RETURNS TABLE (
    valido BOOLEAN,
    mensagem TEXT,
    assinatura_id UUID,
    cliente_id UUID,
    plano_id UUID
) AS $$
DECLARE
    v_licenca RECORD;
    v_assinatura RECORD;
    v_programa_incluso BOOLEAN;
BEGIN
    -- Buscar licença
    SELECT l.*, a.*, p.*
    INTO v_licenca
    FROM licencas l
    JOIN assinaturas a ON l.assinatura_id = a.id
    JOIN planos p ON a.plano_id = p.id
    WHERE l.license_key = p_license_key
    AND l.status = 'ativa'
    AND a.status = 'ativa'
    AND a.data_fim >= CURRENT_DATE;

    -- Se não encontrou licença válida
    IF NOT FOUND THEN
        RETURN QUERY SELECT
            FALSE,
            'Licença inválida ou expirada',
            NULL::UUID,
            NULL::UUID,
            NULL::UUID;
        RETURN;
    END IF;

    -- Verificar se programa está incluído no plano
    v_programa_incluso := programa_incluso_no_plano(
        v_licenca.plano_id,
        p_programa_id
    );

    IF NOT v_programa_incluso THEN
        RETURN QUERY SELECT
            FALSE,
            'Programa não incluído no plano',
            v_licenca.id,
            v_licenca.cliente_id,
            v_licenca.plano_id;
        RETURN;
    END IF;

    -- Atualizar último acesso
    UPDATE licencas
    SET ultimo_acesso = CURRENT_TIMESTAMP
    WHERE license_key = p_license_key;

    -- Retornar sucesso
    RETURN QUERY SELECT
        TRUE,
        'Licença válida',
        v_licenca.id,
        v_licenca.cliente_id,
        v_licenca.plano_id;
END;
$$ LANGUAGE plpgsql;
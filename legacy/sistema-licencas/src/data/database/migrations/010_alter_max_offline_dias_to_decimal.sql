-- Alteração do campo max_offline_dias para aceitar valores decimais

-- Alterar o tipo da coluna max_offline_dias na tabela planos de INTEGER para DECIMAL(10,9)
-- Permite valores como 0.000208333 (30 segundos), 0.5 (12 horas), 1.5, 7.0, etc. (até 9.999999999 dias)
ALTER TABLE planos
ALTER COLUMN max_offline_dias TYPE DECIMAL(10,9);

-- Comentário explicativo
COMMENT ON COLUMN planos.max_offline_dias IS 'Máximo de dias offline permitidos (aceita valores decimais, ex: 0.000208333 = 30 segundos, 0.5 = 12 horas)';

-- Alteração do campo max_offline_hours para aceitar valores decimais
-- Permite valores fracionários como 0.0833 (5 minutos), 0.5 (30 minutos), 2.5 (2 horas e 30 minutos)

ALTER TABLE licencas
ALTER COLUMN max_offline_hours TYPE DECIMAL(10,4);

-- Comentário explicativo
COMMENT ON COLUMN licencas.max_offline_hours IS 'Máximo de horas offline permitidas (aceita valores decimais, ex: 0.0833 = 5 minutos, 0.5 = 30 minutos, 2.5 = 2h30min)';

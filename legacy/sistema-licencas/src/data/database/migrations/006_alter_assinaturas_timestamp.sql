-- Alterar colunas data_inicio e data_fim para suportar timestamp
-- Isso permite armazenar hora/minuto/segundo para assinaturas de curta duração

ALTER TABLE assinaturas
  ALTER COLUMN data_inicio TYPE timestamp with time zone USING data_inicio::timestamp with time zone;

ALTER TABLE assinaturas
  ALTER COLUMN data_fim TYPE timestamp with time zone USING data_fim::timestamp with time zone;
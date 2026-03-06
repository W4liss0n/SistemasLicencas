-- Adicionar campo username à tabela users

-- Adicionar coluna username
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(50);

-- Popular username com base no email (parte antes do @)
UPDATE users
SET username = LOWER(SPLIT_PART(email, '@', 1))
WHERE username IS NULL;

-- Adicionar constraint UNIQUE após popular os dados
ALTER TABLE users ADD CONSTRAINT users_username_unique UNIQUE (username);

-- Tornar campo obrigatório
ALTER TABLE users ALTER COLUMN username SET NOT NULL;

-- Criar índice para otimizar busca por username
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Atualizar usuário admin padrão
UPDATE users
SET username = 'admin'
WHERE email = 'admin@sistema.com';
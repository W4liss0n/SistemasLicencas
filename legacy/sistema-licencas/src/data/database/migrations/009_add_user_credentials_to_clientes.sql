-- Migration: Add user credentials and plano_id to clientes
-- Adiciona campos de usuário, senha e plano ao cliente

-- Remover constraint de email único (email agora é opcional)
ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_email_key;

-- Tornar email opcional
ALTER TABLE clientes ALTER COLUMN email DROP NOT NULL;

-- Adicionar coluna usuario (login do cliente)
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS usuario VARCHAR(100);

-- Adicionar coluna senha (hash da senha)
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS senha VARCHAR(255);

-- Adicionar coluna plano_id (referência ao plano do cliente)
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS plano_id UUID;

-- Adicionar foreign key para planos
ALTER TABLE clientes
ADD CONSTRAINT clientes_plano_id_fkey
FOREIGN KEY (plano_id) REFERENCES planos(id)
ON DELETE SET NULL;

-- Adicionar constraint de unicidade para usuario (não pode duplicar)
ALTER TABLE clientes
ADD CONSTRAINT clientes_usuario_key
UNIQUE (usuario);

-- Criar índice para usuario (para login rápido)
CREATE INDEX IF NOT EXISTS idx_clientes_usuario ON clientes(usuario);

-- Criar índice para plano_id (para consultas rápidas)
CREATE INDEX IF NOT EXISTS idx_clientes_plano_id ON clientes(plano_id);

-- Comentários
COMMENT ON COLUMN clientes.usuario IS 'Login do cliente para acessar o sistema';
COMMENT ON COLUMN clientes.senha IS 'Hash bcrypt da senha do cliente';
COMMENT ON COLUMN clientes.plano_id IS 'Plano padrão do cliente (pode ter múltiplas assinaturas)';
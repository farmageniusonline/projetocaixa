-- ============================================================================
-- TABELA LAUNCHES - LANÇAMENTOS MANUAIS
-- ============================================================================

-- Habilitar extensão UUID se não estiver habilitada
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Criar tabela launches para lançamentos manuais
CREATE TABLE IF NOT EXISTS launches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  launch_date DATE NOT NULL,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('cash', 'debit', 'credit', 'pix')),
  is_link BOOLEAN DEFAULT false,
  value DECIMAL(15, 2) NOT NULL CHECK (value >= 0),
  credit_1x DECIMAL(15, 2) DEFAULT 0 CHECK (credit_1x >= 0),
  credit_2x DECIMAL(15, 2) DEFAULT 0 CHECK (credit_2x >= 0),
  credit_3x DECIMAL(15, 2) DEFAULT 0 CHECK (credit_3x >= 0),
  credit_4x DECIMAL(15, 2) DEFAULT 0 CHECK (credit_4x >= 0),
  credit_5x DECIMAL(15, 2) DEFAULT 0 CHECK (credit_5x >= 0),
  observation TEXT,
  is_outgoing BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar Row Level Security
ALTER TABLE launches ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes se houver conflitos
DROP POLICY IF EXISTS "Users can view own launches" ON launches;
DROP POLICY IF EXISTS "Users can insert own launches" ON launches;
DROP POLICY IF EXISTS "Users can update own launches" ON launches;
DROP POLICY IF EXISTS "Users can delete own launches" ON launches;

-- Criar políticas RLS
CREATE POLICY "Users can view own launches" ON launches
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own launches" ON launches
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own launches" ON launches
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own launches" ON launches
  FOR DELETE USING (auth.uid() = user_id);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS launches_user_id_idx ON launches(user_id);
CREATE INDEX IF NOT EXISTS launches_date_idx ON launches(launch_date);
CREATE INDEX IF NOT EXISTS launches_user_date_idx ON launches(user_id, launch_date);

-- Função para auto-update do campo updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para atualizar updated_at automaticamente
DROP TRIGGER IF EXISTS update_launches_updated_at ON launches;
CREATE TRIGGER update_launches_updated_at
  BEFORE UPDATE ON launches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Verificar se a tabela foi criada
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'launches') THEN
    RAISE NOTICE '✅ Tabela launches criada com sucesso!';
  ELSE
    RAISE NOTICE '❌ Erro ao criar tabela launches';
  END IF;
END $$;
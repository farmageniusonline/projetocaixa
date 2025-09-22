-- ============================================================================
-- CONFIGURAÇÃO COMPLETA DO SUPABASE PARA PROJETO CAIXA MANIPULARIUM
-- ============================================================================

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. TABELA PROFILES (Corrigir problemas RLS)
-- ============================================================================

-- Criar tabela profiles se não existir
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes (se houver conflitos)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Políticas RLS para profiles
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- ============================================================================
-- 2. TABELA LAUNCHES (Lançamentos Manuais)
-- ============================================================================

-- Criar tabela launches
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

-- Habilitar RLS
ALTER TABLE launches ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes (se houver conflitos)
DROP POLICY IF EXISTS "Users can view own launches" ON launches;
DROP POLICY IF EXISTS "Users can insert own launches" ON launches;
DROP POLICY IF EXISTS "Users can update own launches" ON launches;
DROP POLICY IF EXISTS "Users can delete own launches" ON launches;

-- Políticas RLS para launches
CREATE POLICY "Users can view own launches" ON launches
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own launches" ON launches
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own launches" ON launches
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own launches" ON launches
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- 3. ÍNDICES PARA PERFORMANCE
-- ============================================================================

-- Índices para launches
CREATE INDEX IF NOT EXISTS launches_user_id_idx ON launches(user_id);
CREATE INDEX IF NOT EXISTS launches_date_idx ON launches(launch_date);
CREATE INDEX IF NOT EXISTS launches_user_date_idx ON launches(user_id, launch_date);
CREATE INDEX IF NOT EXISTS launches_payment_type_idx ON launches(payment_type);

-- ============================================================================
-- 4. TRIGGERS PARA AUTO-UPDATE
-- ============================================================================

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para profiles
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para launches
DROP TRIGGER IF EXISTS update_launches_updated_at ON launches;
CREATE TRIGGER update_launches_updated_at
  BEFORE UPDATE ON launches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. FUNÇÃO PARA CRIAR PROFILE AUTOMATICAMENTE
-- ============================================================================

-- Função para criar profile quando usuário se registra
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Profile já existe, não fazer nada
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para criar profile automaticamente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 6. VERIFICAÇÃO E LIMPEZA
-- ============================================================================

-- Verificar se as tabelas foram criadas
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'profiles') THEN
    RAISE NOTICE '✅ Tabela profiles criada com sucesso';
  ELSE
    RAISE NOTICE '❌ Erro ao criar tabela profiles';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'launches') THEN
    RAISE NOTICE '✅ Tabela launches criada com sucesso';
  ELSE
    RAISE NOTICE '❌ Erro ao criar tabela launches';
  END IF;
END $$;

-- ============================================================================
-- 7. ESTATÍSTICAS FINAIS
-- ============================================================================

-- Verificar políticas RLS
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('profiles', 'launches')
ORDER BY tablename, policyname;

-- Verificar triggers
SELECT
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers
WHERE event_object_table IN ('profiles', 'launches')
ORDER BY event_object_table, trigger_name;

-- ============================================================================
-- FIM DA CONFIGURAÇÃO
-- ============================================================================

/*
INSTRUÇÕES PARA USAR ESTE ARQUIVO:

1. Acesse o Supabase Dashboard (https://supabase.com)
2. Vá para seu projeto
3. Clique em "SQL Editor"
4. Cole TODO este arquivo SQL
5. Execute clicando em "Run"

Este arquivo irá:
✅ Criar tabela profiles com RLS correta
✅ Criar tabela launches com RLS e validações
✅ Configurar triggers para auto-update
✅ Criar índices para performance
✅ Resolver problemas de "row violates security policy"

Após executar, teste a aplicação novamente.
*/
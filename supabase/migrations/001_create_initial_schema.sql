-- =============================================
-- SISTEMA DE CONFERÊNCIA DE CAIXA
-- Schema inicial para Supabase
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable Row Level Security by default
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- =============================================
-- 1. TABELA DE USUÁRIOS (AUTH)
-- =============================================
-- Complementa a tabela auth.users do Supabase
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user', 'viewer')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  PRIMARY KEY (id)
);

-- RLS para profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- =============================================
-- 2. TABELA DE ARQUIVOS IMPORTADOS
-- =============================================
CREATE TABLE IF NOT EXISTS public.imported_files (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT NOT NULL,
  upload_date TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'error')),
  total_rows INTEGER DEFAULT 0,
  valid_rows INTEGER DEFAULT 0,
  error_rows INTEGER DEFAULT 0,
  warnings_count INTEGER DEFAULT 0,
  processing_time_ms INTEGER,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- RLS para imported_files
ALTER TABLE public.imported_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own files" ON public.imported_files
  FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- 3. TABELA DE TRANSAÇÕES BANCÁRIAS
-- =============================================
CREATE TABLE IF NOT EXISTS public.banking_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  file_id UUID REFERENCES public.imported_files(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Dados da transação
  transaction_date DATE NOT NULL,
  payment_type TEXT NOT NULL,
  cpf TEXT,
  value DECIMAL(15, 2) NOT NULL,
  original_history TEXT,

  -- Metadados de processamento
  row_index INTEGER,
  original_data JSONB,
  normalized_value DECIMAL(15, 2) GENERATED ALWAYS AS (value) STORED,

  -- Status da transação
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'conferred', 'not_found', 'archived')),
  is_transferred BOOLEAN DEFAULT false,

  -- Auditoria
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,

  -- Índices únicos para evitar duplicatas
  UNIQUE(file_id, row_index),
  UNIQUE(transaction_date, payment_type, cpf, value, original_history)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_banking_transactions_date ON public.banking_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_banking_transactions_value ON public.banking_transactions(normalized_value);
CREATE INDEX IF NOT EXISTS idx_banking_transactions_status ON public.banking_transactions(status);
CREATE INDEX IF NOT EXISTS idx_banking_transactions_user ON public.banking_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_banking_transactions_payment_type ON public.banking_transactions(payment_type);

-- RLS para banking_transactions
ALTER TABLE public.banking_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own transactions" ON public.banking_transactions
  FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- 4. TABELA DE CONFERÊNCIA DE CAIXA
-- =============================================
CREATE TABLE IF NOT EXISTS public.cash_conference (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  transaction_id UUID REFERENCES public.banking_transactions(id) ON DELETE CASCADE,

  -- Dados da conferência
  conferred_value DECIMAL(15, 2) NOT NULL,
  conference_date TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  conference_status TEXT DEFAULT 'active' CHECK (conference_status IN ('active', 'removed', 'archived')),

  -- Dados da transação (desnormalizado para performance)
  transaction_date DATE NOT NULL,
  payment_type TEXT NOT NULL,
  cpf TEXT,
  original_value DECIMAL(15, 2) NOT NULL,
  original_history TEXT,

  -- Auditoria
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  removed_at TIMESTAMP WITH TIME ZONE,

  UNIQUE(user_id, transaction_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_cash_conference_date ON public.cash_conference(conference_date);
CREATE INDEX IF NOT EXISTS idx_cash_conference_transaction_date ON public.cash_conference(transaction_date);
CREATE INDEX IF NOT EXISTS idx_cash_conference_user ON public.cash_conference(user_id);
CREATE INDEX IF NOT EXISTS idx_cash_conference_status ON public.cash_conference(conference_status);

-- RLS para cash_conference
ALTER TABLE public.cash_conference ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own conferences" ON public.cash_conference
  FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- 5. TABELA DE HISTÓRICO DE VALORES NÃO ENCONTRADOS
-- =============================================
CREATE TABLE IF NOT EXISTS public.not_found_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Dados do valor pesquisado
  searched_value TEXT NOT NULL,
  normalized_value DECIMAL(15, 2) NOT NULL,
  search_timestamp TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,

  -- Context da busca
  search_context JSONB,
  file_id UUID REFERENCES public.imported_files(id) ON DELETE SET NULL,

  -- Status
  status TEXT DEFAULT 'not_found' CHECK (status IN ('not_found', 'resolved', 'archived')),

  -- Auditoria
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_not_found_search_timestamp ON public.not_found_history(search_timestamp);
CREATE INDEX IF NOT EXISTS idx_not_found_user ON public.not_found_history(user_id);
CREATE INDEX IF NOT EXISTS idx_not_found_value ON public.not_found_history(normalized_value);

-- RLS para not_found_history
ALTER TABLE public.not_found_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own not found history" ON public.not_found_history
  FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- 6. TABELA DE SESSÕES DE TRABALHO
-- =============================================
CREATE TABLE IF NOT EXISTS public.work_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Dados da sessão
  session_date DATE NOT NULL,
  session_name TEXT DEFAULT 'Sessão de trabalho',
  started_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE,

  -- Estatísticas da sessão
  total_transactions INTEGER DEFAULT 0,
  conferred_transactions INTEGER DEFAULT 0,
  not_found_searches INTEGER DEFAULT 0,

  -- Status
  session_status TEXT DEFAULT 'active' CHECK (session_status IN ('active', 'completed', 'archived')),

  -- Auditoria
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,

  UNIQUE(user_id, session_date)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_work_sessions_date ON public.work_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_work_sessions_user ON public.work_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_work_sessions_status ON public.work_sessions(session_status);

-- RLS para work_sessions
ALTER TABLE public.work_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own work sessions" ON public.work_sessions
  FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- COMENTÁRIOS NAS TABELAS
-- =============================================

COMMENT ON TABLE public.profiles IS 'Perfis de usuários complementando auth.users';
COMMENT ON TABLE public.imported_files IS 'Arquivos Excel/CSV importados pelos usuários';
COMMENT ON TABLE public.banking_transactions IS 'Transações bancárias extraídas dos arquivos';
COMMENT ON TABLE public.cash_conference IS 'Registros de conferência de caixa';
COMMENT ON TABLE public.not_found_history IS 'Histórico de valores pesquisados mas não encontrados';
COMMENT ON TABLE public.work_sessions IS 'Sessões de trabalho diárias dos usuários';

-- =============================================
-- FUNÇÃO PARA ATUALIZAR TIMESTAMP
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_imported_files_updated_at BEFORE UPDATE ON public.imported_files
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_banking_transactions_updated_at BEFORE UPDATE ON public.banking_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cash_conference_updated_at BEFORE UPDATE ON public.cash_conference
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_not_found_history_updated_at BEFORE UPDATE ON public.not_found_history
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_work_sessions_updated_at BEFORE UPDATE ON public.work_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
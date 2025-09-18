-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE user_role AS ENUM ('admin', 'user', 'viewer');
CREATE TYPE transaction_status AS ENUM ('pending', 'conferred', 'not_found', 'archived');
CREATE TYPE conference_status AS ENUM ('active', 'completed', 'cancelled');
CREATE TYPE entry_type AS ENUM ('income', 'expense', 'transfer');

-- Users profiles table (extends Supabase Auth)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role user_role DEFAULT 'user',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Banking files table
CREATE TABLE IF NOT EXISTS banking_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  upload_date TIMESTAMPTZ DEFAULT NOW(),
  operation_date DATE,
  total_transactions INTEGER DEFAULT 0,
  total_value DECIMAL(15, 2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'uploaded',
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_file_date UNIQUE (user_id, file_name, operation_date)
);

-- Banking transactions table
CREATE TABLE IF NOT EXISTS banking_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_id UUID REFERENCES banking_files(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL,
  payment_type TEXT,
  cpf VARCHAR(11),
  value DECIMAL(15, 2) NOT NULL,
  value_cents BIGINT GENERATED ALWAYS AS (CAST(value * 100 AS BIGINT)) STORED,
  original_history TEXT,
  status transaction_status DEFAULT 'pending',
  is_transferred BOOLEAN DEFAULT false,
  row_index INTEGER,
  original_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cash conference table
CREATE TABLE IF NOT EXISTS cash_conference (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES banking_transactions(id) ON DELETE SET NULL,
  conferred_value DECIMAL(15, 2) NOT NULL,
  conferred_value_cents BIGINT GENERATED ALWAYS AS (CAST(conferred_value * 100 AS BIGINT)) STORED,
  conference_date DATE DEFAULT CURRENT_DATE,
  transaction_date DATE,
  payment_type TEXT,
  cpf VARCHAR(11),
  original_value DECIMAL(15, 2),
  original_history TEXT,
  conference_status conference_status DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Manual entries table
CREATE TABLE IF NOT EXISTS manual_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date DATE DEFAULT CURRENT_DATE,
  document_number VARCHAR(11),
  description TEXT NOT NULL,
  value DECIMAL(15, 2) NOT NULL,
  value_cents BIGINT GENERATED ALWAYS AS (CAST(value * 100 AS BIGINT)) STORED,
  entry_type entry_type NOT NULL,
  category TEXT,
  is_link BOOLEAN DEFAULT false,
  is_transferred BOOLEAN DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Not found history table
CREATE TABLE IF NOT EXISTS not_found_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  searched_value TEXT NOT NULL,
  normalized_value DECIMAL(15, 2) NOT NULL,
  search_timestamp TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'not_found',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance logs table
CREATE TABLE IF NOT EXISTS performance_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  operation TEXT NOT NULL,
  duration_ms DECIMAL(10, 2) NOT NULL,
  metadata JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  table_name TEXT,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_banking_transactions_user_date ON banking_transactions(user_id, transaction_date);
CREATE INDEX idx_banking_transactions_value ON banking_transactions(value_cents);
CREATE INDEX idx_banking_transactions_status ON banking_transactions(status);
CREATE INDEX idx_banking_transactions_cpf ON banking_transactions(cpf);

CREATE INDEX idx_cash_conference_user_date ON cash_conference(user_id, conference_date);
CREATE INDEX idx_cash_conference_value ON cash_conference(conferred_value_cents);
CREATE INDEX idx_cash_conference_status ON cash_conference(conference_status);

CREATE INDEX idx_manual_entries_user_date ON manual_entries(user_id, entry_date);
CREATE INDEX idx_manual_entries_type ON manual_entries(entry_type);

CREATE INDEX idx_performance_logs_user_operation ON performance_logs(user_id, operation);
CREATE INDEX idx_performance_logs_timestamp ON performance_logs(timestamp);

-- Create update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update timestamp trigger to tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_banking_transactions_updated_at BEFORE UPDATE ON banking_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_cash_conference_updated_at BEFORE UPDATE ON cash_conference
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_manual_entries_updated_at BEFORE UPDATE ON manual_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RPC Functions for complex operations

-- Search transactions by value with tolerance
CREATE OR REPLACE FUNCTION search_transactions_by_value(
  p_user_id UUID,
  p_value DECIMAL,
  p_tolerance DECIMAL DEFAULT 0.01
)
RETURNS TABLE (
  id UUID,
  transaction_date DATE,
  payment_type TEXT,
  cpf VARCHAR(11),
  value DECIMAL,
  original_history TEXT,
  status transaction_status,
  is_transferred BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    bt.id,
    bt.transaction_date,
    bt.payment_type,
    bt.cpf,
    bt.value,
    bt.original_history,
    bt.status,
    bt.is_transferred
  FROM banking_transactions bt
  WHERE bt.user_id = p_user_id
    AND bt.status = 'pending'
    AND ABS(bt.value - p_value) <= p_tolerance
  ORDER BY bt.transaction_date DESC, bt.created_at DESC;
END;
$$;

-- Transfer transaction to conference
CREATE OR REPLACE FUNCTION transfer_to_conference(
  p_user_id UUID,
  p_transaction_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_conference_id UUID;
  v_transaction RECORD;
BEGIN
  -- Get transaction details
  SELECT * INTO v_transaction
  FROM banking_transactions
  WHERE id = p_transaction_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  -- Create conference entry
  INSERT INTO cash_conference (
    user_id,
    transaction_id,
    conferred_value,
    conference_date,
    transaction_date,
    payment_type,
    cpf,
    original_value,
    original_history
  ) VALUES (
    p_user_id,
    p_transaction_id,
    v_transaction.value,
    CURRENT_DATE,
    v_transaction.transaction_date,
    v_transaction.payment_type,
    v_transaction.cpf,
    v_transaction.value,
    v_transaction.original_history
  ) RETURNING id INTO v_conference_id;

  -- Update transaction status
  UPDATE banking_transactions
  SET status = 'conferred', is_transferred = true
  WHERE id = p_transaction_id;

  RETURN v_conference_id;
END;
$$;

-- Remove from conference
CREATE OR REPLACE FUNCTION remove_from_conference(
  p_user_id UUID,
  p_conference_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_transaction_id UUID;
BEGIN
  -- Get transaction ID
  SELECT transaction_id INTO v_transaction_id
  FROM cash_conference
  WHERE id = p_conference_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conference entry not found';
  END IF;

  -- Update transaction status if exists
  IF v_transaction_id IS NOT NULL THEN
    UPDATE banking_transactions
    SET status = 'pending', is_transferred = false
    WHERE id = v_transaction_id;
  END IF;

  -- Delete conference entry
  DELETE FROM cash_conference
  WHERE id = p_conference_id;

  RETURN TRUE;
END;
$$;

-- Register not found value
CREATE OR REPLACE FUNCTION register_not_found(
  p_user_id UUID,
  p_searched_value TEXT,
  p_normalized_value DECIMAL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO not_found_history (
    user_id,
    searched_value,
    normalized_value
  ) VALUES (
    p_user_id,
    p_searched_value,
    p_normalized_value
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Get user statistics
CREATE OR REPLACE FUNCTION get_user_stats(p_user_id UUID)
RETURNS TABLE (
  total_transactions BIGINT,
  total_conferred BIGINT,
  total_pending BIGINT,
  total_not_found BIGINT,
  total_value DECIMAL,
  conferred_value DECIMAL,
  pending_value DECIMAL,
  today_transactions BIGINT,
  today_conferred BIGINT,
  avg_conference_time DECIMAL
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_transactions,
    COUNT(*) FILTER (WHERE status = 'conferred')::BIGINT as total_conferred,
    COUNT(*) FILTER (WHERE status = 'pending')::BIGINT as total_pending,
    COUNT(*) FILTER (WHERE status = 'not_found')::BIGINT as total_not_found,
    COALESCE(SUM(value), 0)::DECIMAL as total_value,
    COALESCE(SUM(value) FILTER (WHERE status = 'conferred'), 0)::DECIMAL as conferred_value,
    COALESCE(SUM(value) FILTER (WHERE status = 'pending'), 0)::DECIMAL as pending_value,
    COUNT(*) FILTER (WHERE transaction_date = CURRENT_DATE)::BIGINT as today_transactions,
    COUNT(*) FILTER (WHERE status = 'conferred' AND transaction_date = CURRENT_DATE)::BIGINT as today_conferred,
    0::DECIMAL as avg_conference_time -- Placeholder for performance metrics
  FROM banking_transactions
  WHERE user_id = p_user_id;
END;
$$;

-- Restart work day (archive current data)
CREATE OR REPLACE FUNCTION restart_work_day(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  -- Archive current pending transactions
  UPDATE banking_transactions
  SET status = 'archived'
  WHERE user_id = p_user_id AND status = 'pending';

  -- Complete active conferences
  UPDATE cash_conference
  SET conference_status = 'completed'
  WHERE user_id = p_user_id AND conference_status = 'active';

  RETURN TRUE;
END;
$$;

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE banking_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE banking_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_conference ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE not_found_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Banking files policies
CREATE POLICY "Users can view own files" ON banking_files
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own files" ON banking_files
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own files" ON banking_files
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own files" ON banking_files
  FOR DELETE USING (auth.uid() = user_id);

-- Banking transactions policies
CREATE POLICY "Users can view own transactions" ON banking_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions" ON banking_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions" ON banking_transactions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions" ON banking_transactions
  FOR DELETE USING (auth.uid() = user_id);

-- Cash conference policies
CREATE POLICY "Users can view own conferences" ON cash_conference
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conferences" ON cash_conference
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conferences" ON cash_conference
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conferences" ON cash_conference
  FOR DELETE USING (auth.uid() = user_id);

-- Manual entries policies
CREATE POLICY "Users can view own entries" ON manual_entries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own entries" ON manual_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own entries" ON manual_entries
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own entries" ON manual_entries
  FOR DELETE USING (auth.uid() = user_id);

-- Not found history policies
CREATE POLICY "Users can view own history" ON not_found_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own history" ON not_found_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Performance logs policies
CREATE POLICY "Users can view own logs" ON performance_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own logs" ON performance_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Audit logs policies (admin only)
CREATE POLICY "Admins can view all audit logs" ON audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "System can insert audit logs" ON audit_logs
  FOR INSERT WITH CHECK (true);
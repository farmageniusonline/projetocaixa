-- Create unified history table for all conference operations
CREATE TABLE IF NOT EXISTS public.conference_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  operation_date DATE NOT NULL,
  operation_type VARCHAR(50) NOT NULL, -- 'banking_upload', 'cash_conference', 'not_found'
  operation_timestamp TIMESTAMPTZ DEFAULT NOW(),

  -- Common fields
  document_number VARCHAR(255),
  date DATE,
  description TEXT,
  value DECIMAL(15, 2),

  -- Banking specific fields
  bank_name VARCHAR(100),
  account_number VARCHAR(50),
  transaction_type VARCHAR(50),
  balance DECIMAL(15, 2),

  -- Conference specific fields
  conferred_at TIMESTAMPTZ,
  conferred_by UUID,
  status VARCHAR(50), -- 'conferred', 'not_found', 'pending'

  -- File upload information
  file_name VARCHAR(255),
  file_upload_date DATE,
  upload_mode VARCHAR(20), -- 'automatic', 'manual'

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID,
  metadata JSONB
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_operation_date ON public.conference_history(operation_date);
CREATE INDEX IF NOT EXISTS idx_operation_type ON public.conference_history(operation_type);
CREATE INDEX IF NOT EXISTS idx_user_id ON public.conference_history(user_id);
CREATE INDEX IF NOT EXISTS idx_status ON public.conference_history(status);
CREATE INDEX IF NOT EXISTS idx_document_number ON public.conference_history(document_number);

-- Create table for tracking daily operations
CREATE TABLE IF NOT EXISTS public.daily_operations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  operation_date DATE NOT NULL UNIQUE,

  -- Banking stats
  banking_total_uploaded INTEGER DEFAULT 0,
  banking_total_value DECIMAL(15, 2) DEFAULT 0,
  banking_conferred_count INTEGER DEFAULT 0,
  banking_conferred_value DECIMAL(15, 2) DEFAULT 0,

  -- Cash conference stats
  cash_conferred_count INTEGER DEFAULT 0,
  cash_conferred_value DECIMAL(15, 2) DEFAULT 0,
  cash_not_found_count INTEGER DEFAULT 0,

  -- File information
  last_file_name VARCHAR(255),
  last_upload_timestamp TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID
);

CREATE INDEX IF NOT EXISTS idx_daily_operation_date ON public.daily_operations(operation_date);
CREATE INDEX IF NOT EXISTS idx_daily_user_id ON public.daily_operations(user_id);

-- Create function to update daily operations stats
CREATE OR REPLACE FUNCTION update_daily_operations_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update daily operations record
  INSERT INTO public.daily_operations (
    operation_date,
    user_id,
    banking_total_uploaded,
    banking_total_value,
    banking_conferred_count,
    banking_conferred_value,
    cash_conferred_count,
    cash_conferred_value,
    cash_not_found_count
  )
  VALUES (
    NEW.operation_date,
    NEW.user_id,
    CASE WHEN NEW.operation_type = 'banking_upload' THEN 1 ELSE 0 END,
    CASE WHEN NEW.operation_type = 'banking_upload' THEN COALESCE(NEW.value, 0) ELSE 0 END,
    CASE WHEN NEW.operation_type = 'cash_conference' AND NEW.status = 'conferred' THEN 1 ELSE 0 END,
    CASE WHEN NEW.operation_type = 'cash_conference' AND NEW.status = 'conferred' THEN COALESCE(NEW.value, 0) ELSE 0 END,
    CASE WHEN NEW.operation_type = 'cash_conference' AND NEW.status = 'conferred' THEN 1 ELSE 0 END,
    CASE WHEN NEW.operation_type = 'cash_conference' AND NEW.status = 'conferred' THEN COALESCE(NEW.value, 0) ELSE 0 END,
    CASE WHEN NEW.status = 'not_found' THEN 1 ELSE 0 END
  )
  ON CONFLICT (operation_date) DO UPDATE SET
    banking_total_uploaded = daily_operations.banking_total_uploaded +
      CASE WHEN NEW.operation_type = 'banking_upload' THEN 1 ELSE 0 END,
    banking_total_value = daily_operations.banking_total_value +
      CASE WHEN NEW.operation_type = 'banking_upload' THEN COALESCE(NEW.value, 0) ELSE 0 END,
    banking_conferred_count = daily_operations.banking_conferred_count +
      CASE WHEN NEW.operation_type = 'cash_conference' AND NEW.status = 'conferred' THEN 1 ELSE 0 END,
    banking_conferred_value = daily_operations.banking_conferred_value +
      CASE WHEN NEW.operation_type = 'cash_conference' AND NEW.status = 'conferred' THEN COALESCE(NEW.value, 0) ELSE 0 END,
    cash_conferred_count = daily_operations.cash_conferred_count +
      CASE WHEN NEW.operation_type = 'cash_conference' AND NEW.status = 'conferred' THEN 1 ELSE 0 END,
    cash_conferred_value = daily_operations.cash_conferred_value +
      CASE WHEN NEW.operation_type = 'cash_conference' AND NEW.status = 'conferred' THEN COALESCE(NEW.value, 0) ELSE 0 END,
    cash_not_found_count = daily_operations.cash_not_found_count +
      CASE WHEN NEW.status = 'not_found' THEN 1 ELSE 0 END,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updating daily operations
DROP TRIGGER IF EXISTS update_daily_operations_on_history_insert ON public.conference_history;
CREATE TRIGGER update_daily_operations_on_history_insert
  AFTER INSERT ON public.conference_history
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_operations_stats();

-- Create view for easy querying of daily summaries
CREATE OR REPLACE VIEW public.daily_summary AS
SELECT
  daily_ops.operation_date,
  daily_ops.banking_total_uploaded,
  daily_ops.banking_total_value,
  daily_ops.banking_conferred_count,
  daily_ops.banking_conferred_value,
  daily_ops.cash_conferred_count,
  daily_ops.cash_conferred_value,
  daily_ops.cash_not_found_count,
  daily_ops.last_file_name,
  daily_ops.last_upload_timestamp,
  daily_ops.user_id,
  (daily_ops.banking_conferred_count + daily_ops.cash_conferred_count) as total_conferred,
  (daily_ops.banking_conferred_value + daily_ops.cash_conferred_value) as total_value
FROM public.daily_operations daily_ops
ORDER BY daily_ops.operation_date DESC;

-- Add additional indexes for better performance
CREATE INDEX IF NOT EXISTS idx_conference_history_composite ON public.conference_history(operation_date, operation_type, status);
CREATE INDEX IF NOT EXISTS idx_conference_history_user_date ON public.conference_history(user_id, operation_date);
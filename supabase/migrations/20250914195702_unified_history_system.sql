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
  conferred_by UUID REFERENCES auth.users(id),
  status VARCHAR(50), -- 'conferred', 'not_found', 'pending'

  -- File upload information
  file_name VARCHAR(255),
  file_upload_date DATE,
  upload_mode VARCHAR(20), -- 'automatic', 'manual'

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id),
  metadata JSONB
);

-- Create indexes
CREATE INDEX idx_operation_date ON public.conference_history(operation_date);
CREATE INDEX idx_operation_type ON public.conference_history(operation_type);
CREATE INDEX idx_user_id ON public.conference_history(user_id);
CREATE INDEX idx_status ON public.conference_history(status);
CREATE INDEX idx_document_number ON public.conference_history(document_number);

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
  user_id UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_daily_operation_date ON public.daily_operations(operation_date);
CREATE INDEX idx_daily_user_id ON public.daily_operations(user_id);

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
CREATE TRIGGER update_daily_operations_on_history_insert
  AFTER INSERT ON public.conference_history
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_operations_stats();

-- Create view for easy querying of daily summaries
CREATE VIEW public.daily_summary AS
SELECT
  do.operation_date,
  do.banking_total_uploaded,
  do.banking_total_value,
  do.banking_conferred_count,
  do.banking_conferred_value,
  do.cash_conferred_count,
  do.cash_conferred_value,
  do.cash_not_found_count,
  do.last_file_name,
  do.last_upload_timestamp,
  u.email as user_email,
  (do.banking_conferred_count + do.cash_conferred_count) as total_conferred,
  (do.banking_conferred_value + do.cash_conferred_value) as total_value
FROM public.daily_operations do
LEFT JOIN auth.users u ON do.user_id = u.id
ORDER BY do.operation_date DESC;

-- RLS policies for conference_history
ALTER TABLE public.conference_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own history"
  ON public.conference_history
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own history"
  ON public.conference_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own history"
  ON public.conference_history
  FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS policies for daily_operations
ALTER TABLE public.daily_operations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own daily operations"
  ON public.daily_operations
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own daily operations"
  ON public.daily_operations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily operations"
  ON public.daily_operations
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Add indexes for better performance
CREATE INDEX idx_conference_history_composite ON public.conference_history(operation_date, operation_type, status);
CREATE INDEX idx_conference_history_user_date ON public.conference_history(user_id, operation_date);
-- Create launches table for the LaunchTab component
CREATE TABLE IF NOT EXISTS launches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  launch_date DATE NOT NULL,
  payment_type TEXT NOT NULL,
  is_link BOOLEAN DEFAULT false,
  value DECIMAL(15, 2) NOT NULL,
  value_cents BIGINT GENERATED ALWAYS AS (CAST(value * 100 AS BIGINT)) STORED,

  -- Credit card installments
  credit_1x DECIMAL(15, 2) DEFAULT 0,
  credit_2x DECIMAL(15, 2) DEFAULT 0,
  credit_3x DECIMAL(15, 2) DEFAULT 0,
  credit_4x DECIMAL(15, 2) DEFAULT 0,
  credit_5x DECIMAL(15, 2) DEFAULT 0,

  -- Additional fields
  observation TEXT,
  is_outgoing BOOLEAN DEFAULT false,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT launches_value_positive CHECK (value >= 0),
  CONSTRAINT launches_credit_positive CHECK (
    COALESCE(credit_1x, 0) >= 0 AND
    COALESCE(credit_2x, 0) >= 0 AND
    COALESCE(credit_3x, 0) >= 0 AND
    COALESCE(credit_4x, 0) >= 0 AND
    COALESCE(credit_5x, 0) >= 0
  )
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_launches_user_id ON launches(user_id);
CREATE INDEX IF NOT EXISTS idx_launches_date ON launches(launch_date);
CREATE INDEX IF NOT EXISTS idx_launches_payment_type ON launches(payment_type);
CREATE INDEX IF NOT EXISTS idx_launches_created_at ON launches(created_at);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_launches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_launches_updated_at
  BEFORE UPDATE ON launches
  FOR EACH ROW
  EXECUTE FUNCTION update_launches_updated_at();

-- Add RLS (Row Level Security) policies
ALTER TABLE launches ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own launches
CREATE POLICY "Users can view own launches" ON launches
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own launches
CREATE POLICY "Users can insert own launches" ON launches
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own launches
CREATE POLICY "Users can update own launches" ON launches
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can delete their own launches
CREATE POLICY "Users can delete own launches" ON launches
  FOR DELETE USING (auth.uid() = user_id);
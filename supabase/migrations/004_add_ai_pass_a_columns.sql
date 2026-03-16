-- Add TEXT to signal_value_type enum (for AI-generated signals)
DO $$
BEGIN
  ALTER TYPE signal_value_type ADD VALUE 'TEXT';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

-- Add value_text and rationale to risk_signals
ALTER TABLE risk_signals ADD COLUMN IF NOT EXISTS value_text text;
ALTER TABLE risk_signals ADD COLUMN IF NOT EXISTS rationale text;

-- Add pass_a metadata to impact_assessments
ALTER TABLE impact_assessments ADD COLUMN IF NOT EXISTS pass_a_model text;
ALTER TABLE impact_assessments ADD COLUMN IF NOT EXISTS pass_a_ran_at timestamptz;

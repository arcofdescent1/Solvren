ALTER TABLE risk_learning_baseline ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rlb_select ON risk_learning_baseline;
CREATE POLICY rlb_select ON risk_learning_baseline FOR SELECT USING (auth.uid() IS NOT NULL);

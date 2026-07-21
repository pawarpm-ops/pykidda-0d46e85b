-- Explicitly deny client-side writes to mock_results and ai_mock_attempts.
-- All legitimate writes go through server functions using supabaseAdmin (service_role),
-- which bypasses RLS. These restrictive policies make the "no client writes" contract
-- explicit and satisfy the security scanner.

CREATE POLICY "Deny client inserts to mock_results"
  ON public.mock_results FOR INSERT TO authenticated, anon
  WITH CHECK (false);

CREATE POLICY "Deny client updates to mock_results"
  ON public.mock_results FOR UPDATE TO authenticated, anon
  USING (false) WITH CHECK (false);

CREATE POLICY "Deny client deletes to mock_results"
  ON public.mock_results FOR DELETE TO authenticated, anon
  USING (false);

CREATE POLICY "Deny client inserts to ai_mock_attempts"
  ON public.ai_mock_attempts FOR INSERT TO authenticated, anon
  WITH CHECK (false);

CREATE POLICY "Deny client updates to ai_mock_attempts"
  ON public.ai_mock_attempts FOR UPDATE TO authenticated, anon
  USING (false) WITH CHECK (false);

CREATE POLICY "Deny client deletes to ai_mock_attempts"
  ON public.ai_mock_attempts FOR DELETE TO authenticated, anon
  USING (false);
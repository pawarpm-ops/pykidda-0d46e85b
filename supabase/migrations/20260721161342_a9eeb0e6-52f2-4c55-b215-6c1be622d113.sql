
-- Streak activity logs: writes only via SECURITY DEFINER RPC record_streak_activity.
-- Make that intent explicit with a restrictive deny policy so any direct client
-- INSERT/UPDATE/DELETE is refused, even if grants change later.
REVOKE INSERT, UPDATE, DELETE ON public.streak_activity_logs FROM authenticated, anon;

DROP POLICY IF EXISTS "Deny direct client writes on streak_activity_logs" ON public.streak_activity_logs;
CREATE POLICY "Deny direct client writes on streak_activity_logs"
  ON public.streak_activity_logs
  AS RESTRICTIVE
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- Pyko assessment sessions: writes only via SECURITY DEFINER RPCs
-- pyko_start_assessment / pyko_end_assessment.
REVOKE INSERT, UPDATE, DELETE ON public.pyko_assessment_sessions FROM authenticated, anon;

DROP POLICY IF EXISTS "Deny direct client writes on pyko_assessment_sessions" ON public.pyko_assessment_sessions;
CREATE POLICY "Deny direct client writes on pyko_assessment_sessions"
  ON public.pyko_assessment_sessions
  AS RESTRICTIVE
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);


-- Lock down streak tables: all writes must go through record_streak_activity RPC
REVOKE INSERT, UPDATE, DELETE ON public.student_streaks FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.streak_activity_logs FROM authenticated, anon;
DROP POLICY IF EXISTS "Users insert own logs" ON public.streak_activity_logs;

-- Lock down leaderboard_scores: no direct writes from clients
REVOKE INSERT, UPDATE, DELETE ON public.leaderboard_scores FROM authenticated, anon;

-- Lock down AI mock tables: writes only via service_role server functions
REVOKE INSERT, UPDATE, DELETE ON public.ai_mock_attempts FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.ai_mock_questions FROM authenticated, anon;
REVOKE SELECT ON public.ai_mock_questions FROM authenticated, anon;

-- Explicit deny-by-default SELECT policy on ai_mock_questions so future
-- grants can't accidentally expose correct answers. All legitimate reads
-- go through server functions using the service role (which bypasses RLS).
DROP POLICY IF EXISTS "no direct question reads" ON public.ai_mock_questions;
CREATE POLICY "no direct question reads"
  ON public.ai_mock_questions
  FOR SELECT
  TO authenticated, anon
  USING (false);

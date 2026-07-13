
-- Tighten write policies on mock_test_attempt_comments: even admins (the only role able to write)
-- must set teacher_id to their own auth.uid(), preventing impersonation of another teacher.
DROP POLICY IF EXISTS "Admins manage all mock comments" ON public.mock_test_attempt_comments;

CREATE POLICY "Admins read all mock comments"
  ON public.mock_test_attempt_comments FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert own mock comments"
  ON public.mock_test_attempt_comments FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND teacher_id = auth.uid());

CREATE POLICY "Admins update own mock comments"
  ON public.mock_test_attempt_comments FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND teacher_id = auth.uid())
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND teacher_id = auth.uid());

CREATE POLICY "Admins delete own mock comments"
  ON public.mock_test_attempt_comments FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND teacher_id = auth.uid());

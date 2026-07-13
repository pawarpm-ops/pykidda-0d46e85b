-- Revert to row-level visibility for students, but block the two sensitive
-- answer columns via column-level privileges. Only service_role (trusted
-- server code) can read mcq_correct and test_cases.

DROP VIEW IF EXISTS public.homework_questions_public;

DROP POLICY IF EXISTS "Admins and owners read questions" ON public.homework_questions;

CREATE POLICY "Read questions when hw visible"
  ON public.homework_questions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.homework h
      WHERE h.id = homework_questions.homework_id
        AND (
          h.status IN ('published', 'closed')
          OR h.created_by = auth.uid()
          OR public.has_role(auth.uid(), 'admin'::public.app_role)
        )
    )
  );

-- Column-level privileges: hide answer keys from every non-service role.
REVOKE SELECT (mcq_correct, test_cases) ON public.homework_questions FROM anon;
REVOKE SELECT (mcq_correct, test_cases) ON public.homework_questions FROM authenticated;
REVOKE SELECT (mcq_correct, test_cases) ON public.homework_questions FROM PUBLIC;
GRANT  SELECT (mcq_correct, test_cases) ON public.homework_questions TO service_role;
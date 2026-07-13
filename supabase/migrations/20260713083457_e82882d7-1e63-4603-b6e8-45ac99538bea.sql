-- Hide homework answer keys (mcq_correct, test_cases) from students at the DB layer.
-- 1) Restrict base table SELECT to admins and the homework creator.
-- 2) Expose a safe view without answer columns for students to read.

DROP POLICY IF EXISTS "Read questions when hw visible" ON public.homework_questions;

CREATE POLICY "Admins and owners read questions"
  ON public.homework_questions
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.homework h
      WHERE h.id = homework_questions.homework_id
        AND h.created_by = auth.uid()
    )
  );

-- Safe view for students: excludes mcq_correct and test_cases.
-- security_invoker=off so the view can read the underlying table using its
-- owner's privileges; visibility is enforced by the WHERE clause below.
CREATE OR REPLACE VIEW public.homework_questions_public
WITH (security_invoker = off) AS
  SELECT
    q.id,
    q.homework_id,
    q.question_order,
    q.question_type,
    q.title,
    q.description,
    q.marks,
    q.difficulty,
    q.input_format,
    q.output_format,
    q.sample_input,
    q.sample_output,
    q.hints,
    q.mcq_options,
    q.starter_code,
    q.created_at,
    q.updated_at
  FROM public.homework_questions q
  JOIN public.homework h ON h.id = q.homework_id
  WHERE h.status IN ('published', 'closed');

GRANT SELECT ON public.homework_questions_public TO authenticated;
GRANT ALL  ON public.homework_questions_public TO service_role;
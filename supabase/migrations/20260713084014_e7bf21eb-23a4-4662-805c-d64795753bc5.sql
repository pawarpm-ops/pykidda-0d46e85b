-- =========================================================
-- 1) homework_questions: block direct SELECT on answer columns
-- =========================================================

-- Reset column-level revokes from previous attempt (they were shadowed by
-- the table-level GRANT). Now revoke SELECT on the whole table and grant it
-- back only on the safe columns.
REVOKE SELECT ON public.homework_questions FROM anon;
REVOKE SELECT ON public.homework_questions FROM authenticated;

GRANT SELECT (
  id, homework_id, question_order, question_type, title, description,
  marks, difficulty, input_format, output_format, sample_input, sample_output,
  hints, mcq_options, starter_code, created_at, updated_at
) ON public.homework_questions TO authenticated;

-- INSERT/UPDATE/DELETE remain governed by the existing RLS policies
-- ("Admins manage questions"). Ensure the DML grants are present.
GRANT INSERT, UPDATE, DELETE ON public.homework_questions TO authenticated;
GRANT ALL ON public.homework_questions TO service_role;

-- =========================================================
-- 2) assignments: block direct SELECT on expected_output / test_cases
-- =========================================================

REVOKE SELECT ON public.assignments FROM anon;
REVOKE SELECT ON public.assignments FROM authenticated;

GRANT SELECT (
  id, title, description, unit, topic, difficulty, assignment_type,
  total_marks, due_at, allow_late_submission, status,
  sample_input, sample_output, starter_code, created_by, created_at, updated_at,
  question_source, refined_by_ai, submission_mode,
  input_format, output_format, constraints, hints, instructions,
  ai_prompt_summary
) ON public.assignments TO authenticated;

GRANT INSERT, UPDATE, DELETE ON public.assignments TO authenticated;
GRANT ALL ON public.assignments TO service_role;

-- =========================================================
-- 3) avatars storage bucket: scope SELECT to owner + admin
-- =========================================================

DROP POLICY IF EXISTS "Authenticated users can read avatar files" ON storage.objects;

CREATE POLICY "Users read own avatar or admin"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (
      (auth.uid())::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );
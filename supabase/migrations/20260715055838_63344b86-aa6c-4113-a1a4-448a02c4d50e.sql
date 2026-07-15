
-- =========================================================================
-- homework_submissions: split student vs admin write policies so students
-- can never write grading fields (total_marks_obtained, teacher_feedback,
-- checked_by, checked_at) or set status to a graded value.
-- =========================================================================
DROP POLICY IF EXISTS "Insert own submissions" ON public.homework_submissions;
DROP POLICY IF EXISTS "Update own submissions" ON public.homework_submissions;

CREATE POLICY "Students insert own submissions"
ON public.homework_submissions
FOR INSERT
TO authenticated
WITH CHECK (
  student_id = auth.uid()
  AND total_marks_obtained IS NULL
  AND teacher_feedback IS NULL
  AND checked_by IS NULL
  AND checked_at IS NULL
  AND status IN ('not_submitted','submitted','late')
);

CREATE POLICY "Students update own submissions"
ON public.homework_submissions
FOR UPDATE
TO authenticated
USING (student_id = auth.uid())
WITH CHECK (
  student_id = auth.uid()
  AND total_marks_obtained IS NULL
  AND teacher_feedback IS NULL
  AND checked_by IS NULL
  AND checked_at IS NULL
  AND status IN ('not_submitted','submitted','late')
);

CREATE POLICY "Admins insert submissions"
ON public.homework_submissions
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins update submissions"
ON public.homework_submissions
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- =========================================================================
-- homework_question_answers: students may write only content fields
-- (student_answer, student_code, execution_output). Grading fields
-- (marks_awarded, teacher_comment, checked_status, auto_check_result)
-- stay admin-only via a separate policy.
-- =========================================================================
DROP POLICY IF EXISTS "Insert own answers" ON public.homework_question_answers;
DROP POLICY IF EXISTS "Update own answers" ON public.homework_question_answers;

CREATE POLICY "Students insert own answers"
ON public.homework_question_answers
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.homework_submissions s
    WHERE s.id = homework_question_answers.submission_id
      AND s.student_id = auth.uid()
  )
  AND marks_awarded IS NULL
  AND teacher_comment IS NULL
  AND auto_check_result IS NULL
  AND checked_status = 'pending'
);

CREATE POLICY "Students update own answers"
ON public.homework_question_answers
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.homework_submissions s
    WHERE s.id = homework_question_answers.submission_id
      AND s.student_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.homework_submissions s
    WHERE s.id = homework_question_answers.submission_id
      AND s.student_id = auth.uid()
  )
  AND marks_awarded IS NULL
  AND teacher_comment IS NULL
  AND auto_check_result IS NULL
  AND checked_status = 'pending'
);

CREATE POLICY "Admins insert answers"
ON public.homework_question_answers
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins update answers"
ON public.homework_question_answers
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

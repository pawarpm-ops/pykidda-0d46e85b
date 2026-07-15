DROP POLICY IF EXISTS "Students update own answers" ON public.assignment_submissions;
CREATE POLICY "Students update own answers" ON public.assignment_submissions
FOR UPDATE TO authenticated
USING (
  student_id = auth.uid()
  AND status = ANY (ARRAY['pending'::text, 'submitted'::text, 'late'::text])
)
WITH CHECK (
  student_id = auth.uid()
  AND status = ANY (ARRAY['pending'::text, 'submitted'::text, 'late'::text])
  AND marks_obtained IS NULL
  AND teacher_feedback IS NULL
  AND reviewed_by IS NULL
  AND reviewed_at IS NULL
);
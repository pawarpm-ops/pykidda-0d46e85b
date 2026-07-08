
-- 1) Split assignment_submissions UPDATE policy + trigger to prevent students tampering with grades
DROP POLICY IF EXISTS "Students update own draft" ON public.assignment_submissions;

CREATE POLICY "Students update own answers"
ON public.assignment_submissions
FOR UPDATE TO authenticated
USING (student_id = auth.uid() AND status IN ('pending','submitted','late'))
WITH CHECK (student_id = auth.uid() AND status IN ('pending','submitted','late'));

CREATE POLICY "Admins update any submission"
ON public.assignment_submissions
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.protect_submission_grade_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins can change anything; non-admins are blocked from grading fields.
  IF public.has_role(auth.uid(),'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.marks_obtained IS DISTINCT FROM OLD.marks_obtained
     OR NEW.teacher_feedback IS DISTINCT FROM OLD.teacher_feedback
     OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
     OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
     OR NEW.student_id IS DISTINCT FROM OLD.student_id
     OR NEW.assignment_id IS DISTINCT FROM OLD.assignment_id
     OR (NEW.status = 'reviewed' AND OLD.status IS DISTINCT FROM 'reviewed')
  THEN
    RAISE EXCEPTION 'Not allowed to modify grading fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_submission_grade_fields ON public.assignment_submissions;
CREATE TRIGGER protect_submission_grade_fields
BEFORE UPDATE ON public.assignment_submissions
FOR EACH ROW EXECUTE FUNCTION public.protect_submission_grade_fields();

-- 2) Also block students from INSERTing pre-graded rows
DROP POLICY IF EXISTS "Students insert own submissions" ON public.assignment_submissions;
CREATE POLICY "Students insert own submissions"
ON public.assignment_submissions
FOR INSERT TO authenticated
WITH CHECK (
  student_id = auth.uid()
  AND marks_obtained IS NULL
  AND teacher_feedback IS NULL
  AND reviewed_by IS NULL
  AND reviewed_at IS NULL
  AND status IN ('pending','submitted','late')
);

-- 3) Lock down internal SECURITY DEFINER helpers from anon
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_streak_activity(text, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_streak_activity(text, text) TO authenticated, service_role;

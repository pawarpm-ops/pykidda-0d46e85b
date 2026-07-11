
CREATE OR REPLACE FUNCTION public.protect_submission_grade_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Service role (server-side auto-grader) and admins can change grading fields.
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(),'admin'::public.app_role) THEN
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
$function$;

CREATE OR REPLACE FUNCTION public.enforce_submission_timestamps()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _due TIMESTAMPTZ;
  _allow_late BOOLEAN;
  _now TIMESTAMPTZ := now();
BEGIN
  -- Service role and admins may set any values (used for auto-grade, backfills).
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  SELECT due_at, allow_late_submission INTO _due, _allow_late
  FROM public.assignments WHERE id = NEW.assignment_id;

  IF NEW.status IN ('submitted', 'late') THEN
    NEW.submitted_at := _now;
    IF _due IS NOT NULL AND _now > _due THEN
      NEW.is_late := TRUE;
      NEW.status  := 'late';
    ELSE
      NEW.is_late := FALSE;
      NEW.status  := 'submitted';
    END IF;
  ELSIF NEW.status = 'pending' THEN
    NEW.submitted_at := NULL;
    NEW.is_late := FALSE;
  END IF;

  RETURN NEW;
END;
$function$;

-- Restrict EXECUTE (as in prior hardening migration)
REVOKE EXECUTE ON FUNCTION public.protect_submission_grade_fields() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_submission_timestamps() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.enforce_submission_timestamps()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _due TIMESTAMPTZ;
  _allow_late BOOLEAN;
  _now TIMESTAMPTZ := now();
BEGIN
  -- Admins may set any values (used for grading fixes and backfills).
  IF public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  SELECT due_at, allow_late_submission INTO _due, _allow_late
  FROM public.assignments WHERE id = NEW.assignment_id;

  -- Only stamp submitted_at / is_late when the row is actually being submitted
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
    -- Draft-in-progress row; never mark late or stamp a time.
    NEW.submitted_at := NULL;
    NEW.is_late := FALSE;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_submission_timestamps ON public.assignment_submissions;
CREATE TRIGGER trg_enforce_submission_timestamps
BEFORE INSERT OR UPDATE ON public.assignment_submissions
FOR EACH ROW EXECUTE FUNCTION public.enforce_submission_timestamps();
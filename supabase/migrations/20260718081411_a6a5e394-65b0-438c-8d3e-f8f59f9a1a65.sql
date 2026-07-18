
-- Pyko assessment sessions (server-tracked lockout, replaces heuristic on ai_mock_attempts).
CREATE TABLE IF NOT EXISTS public.pyko_assessment_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assessment_id text NOT NULL,
  assessment_type text NOT NULL CHECK (assessment_type IN ('standard','ai','scheduled')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','expired','abandoned')),
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

GRANT SELECT ON public.pyko_assessment_sessions TO authenticated;
GRANT ALL ON public.pyko_assessment_sessions TO service_role;

ALTER TABLE public.pyko_assessment_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pyko_assess_owner_read" ON public.pyko_assessment_sessions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS pyko_assess_user_active_idx
  ON public.pyko_assessment_sessions(user_id, status)
  WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS pyko_assess_one_active_per_user_idx
  ON public.pyko_assessment_sessions(user_id)
  WHERE status = 'active';

-- Budget counters: per-minute cap columns.
ALTER TABLE public.pyko_budget_counters
  ADD COLUMN IF NOT EXISTS minute_bucket timestamptz,
  ADD COLUMN IF NOT EXISTS minute_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tokens_in integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tokens_out integer NOT NULL DEFAULT 0;

-- Atomic budget touch: single round-trip enforcement + increment.
CREATE OR REPLACE FUNCTION public.pyko_touch_budget(
  _user_id uuid,
  _day date,
  _limit int,
  _per_minute_limit int
)
RETURNS TABLE(used int, per_minute_used int, allowed boolean, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _now timestamptz := now();
  _minute timestamptz := date_trunc('minute', _now);
  _row public.pyko_budget_counters;
BEGIN
  INSERT INTO public.pyko_budget_counters(user_id, day, request_count, minute_bucket, minute_count, updated_at)
  VALUES (_user_id, _day, 0, _minute, 0, _now)
  ON CONFLICT (user_id, day) DO NOTHING;

  SELECT * INTO _row FROM public.pyko_budget_counters
    WHERE user_id = _user_id AND day = _day FOR UPDATE;

  IF _row.minute_bucket IS NULL OR _row.minute_bucket <> _minute THEN
    _row.minute_bucket := _minute;
    _row.minute_count := 0;
  END IF;

  IF _row.request_count >= _limit THEN
    used := _row.request_count;
    per_minute_used := _row.minute_count;
    allowed := false;
    reason := 'daily_limit';
    RETURN NEXT; RETURN;
  END IF;

  IF _row.minute_count >= _per_minute_limit THEN
    used := _row.request_count;
    per_minute_used := _row.minute_count;
    allowed := false;
    reason := 'per_minute_limit';
    RETURN NEXT; RETURN;
  END IF;

  UPDATE public.pyko_budget_counters
    SET request_count = _row.request_count + 1,
        minute_bucket = _minute,
        minute_count = _row.minute_count + 1,
        updated_at = _now
    WHERE user_id = _user_id AND day = _day
    RETURNING request_count, minute_count INTO used, per_minute_used;

  allowed := true;
  reason := 'ok';
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.pyko_touch_budget(uuid, date, int, int) FROM public;
GRANT EXECUTE ON FUNCTION public.pyko_touch_budget(uuid, date, int, int) TO service_role;

-- Assessment session start/end/query, SECURITY DEFINER, scoped to auth.uid().
CREATE OR REPLACE FUNCTION public.pyko_start_assessment(
  _assessment_id text,
  _type text,
  _duration_minutes int DEFAULT 120
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _type NOT IN ('standard','ai','scheduled') THEN RAISE EXCEPTION 'Invalid type'; END IF;

  -- Expire stale sessions for this user (safety net).
  UPDATE public.pyko_assessment_sessions
    SET status = 'expired', completed_at = now()
    WHERE user_id = _uid AND status = 'active' AND expires_at IS NOT NULL AND expires_at < now();

  -- If already active for the same assessment, reuse.
  SELECT id INTO _id FROM public.pyko_assessment_sessions
    WHERE user_id = _uid AND assessment_id = _assessment_id AND status = 'active'
    LIMIT 1;
  IF _id IS NOT NULL THEN
    UPDATE public.pyko_assessment_sessions SET last_activity_at = now() WHERE id = _id;
    RETURN _id;
  END IF;

  -- Close any other active session before creating a new one.
  UPDATE public.pyko_assessment_sessions
    SET status = 'abandoned', completed_at = now()
    WHERE user_id = _uid AND status = 'active';

  INSERT INTO public.pyko_assessment_sessions(user_id, assessment_id, assessment_type, expires_at)
  VALUES (_uid, _assessment_id, _type, now() + make_interval(mins => GREATEST(_duration_minutes, 1)))
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.pyko_start_assessment(text, text, int) FROM public;
GRANT EXECUTE ON FUNCTION public.pyko_start_assessment(text, text, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.pyko_end_assessment(
  _assessment_id text,
  _reason text DEFAULT 'completed'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _status text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  _status := CASE WHEN _reason = 'expired' THEN 'expired'
                  WHEN _reason = 'abandoned' THEN 'abandoned'
                  ELSE 'completed' END;
  UPDATE public.pyko_assessment_sessions
    SET status = _status, completed_at = now()
    WHERE user_id = _uid AND assessment_id = _assessment_id AND status = 'active';
END;
$$;

REVOKE ALL ON FUNCTION public.pyko_end_assessment(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.pyko_end_assessment(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.pyko_has_active_assessment(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.pyko_assessment_sessions
    WHERE user_id = _user_id AND status = 'active'
      AND (expires_at IS NULL OR expires_at > now())
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pyko_has_active_assessment(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.pyko_has_active_assessment(uuid) TO authenticated, service_role;

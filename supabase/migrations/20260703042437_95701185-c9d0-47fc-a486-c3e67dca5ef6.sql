
-- Streak system tables
CREATE TABLE public.student_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_activity_date DATE,
  today_completed BOOLEAN NOT NULL DEFAULT false,
  streak_freezes_available INTEGER NOT NULL DEFAULT 0,
  streak_freezes_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.student_streaks TO authenticated;
GRANT ALL ON public.student_streaks TO service_role;

ALTER TABLE public.student_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own streak" ON public.student_streaks
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own streak" ON public.student_streaks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own streak" ON public.student_streaks
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.streak_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL,
  activity_type TEXT NOT NULL,
  activity_reference_id TEXT,
  points_earned INTEGER NOT NULL DEFAULT 0,
  streak_count_after_activity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_streak_logs_user_date ON public.streak_activity_logs(user_id, activity_date DESC);

GRANT SELECT, INSERT ON public.streak_activity_logs TO authenticated;
GRANT ALL ON public.streak_activity_logs TO service_role;

ALTER TABLE public.streak_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own logs" ON public.streak_activity_logs
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own logs" ON public.streak_activity_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_streak_updated_at BEFORE UPDATE ON public.student_streaks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Atomic streak-tick RPC. Handles day increment, reset, longest tracking.
CREATE OR REPLACE FUNCTION public.record_streak_activity(
  _activity_type TEXT,
  _reference_id TEXT DEFAULT NULL
)
RETURNS TABLE(current_streak INTEGER, longest_streak INTEGER, today_completed BOOLEAN, is_new_day BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _today DATE := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  _row public.student_streaks;
  _new_streak INTEGER;
  _is_new_day BOOLEAN := false;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.student_streaks(user_id, current_streak, longest_streak, last_activity_date, today_completed)
  VALUES (_uid, 0, 0, NULL, false)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO _row FROM public.student_streaks WHERE user_id = _uid FOR UPDATE;

  IF _row.last_activity_date = _today THEN
    _new_streak := _row.current_streak;
  ELSIF _row.last_activity_date = _today - INTERVAL '1 day' THEN
    _new_streak := _row.current_streak + 1;
    _is_new_day := true;
  ELSE
    _new_streak := 1;
    _is_new_day := true;
  END IF;

  UPDATE public.student_streaks
  SET current_streak = _new_streak,
      longest_streak = GREATEST(longest_streak, _new_streak),
      last_activity_date = _today,
      today_completed = true
  WHERE user_id = _uid;

  INSERT INTO public.streak_activity_logs(user_id, activity_date, activity_type, activity_reference_id, streak_count_after_activity, points_earned)
  VALUES (_uid, _today, _activity_type, _reference_id, _new_streak, 10);

  RETURN QUERY SELECT _new_streak, GREATEST(_row.longest_streak, _new_streak), true, _is_new_day;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_streak_activity(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_streak_activity(TEXT, TEXT) TO authenticated;

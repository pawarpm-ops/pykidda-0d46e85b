
DROP FUNCTION IF EXISTS public.record_streak_activity(text, text);

CREATE OR REPLACE FUNCTION public.record_streak_activity(_activity_type text, _reference_id text DEFAULT NULL::text)
 RETURNS TABLE(current_streak integer, longest_streak integer, today_completed boolean, is_new_day boolean, freeze_used boolean, freezes_available integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid UUID := auth.uid();
  _today DATE := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  _month_start DATE := date_trunc('month', _today)::date;
  _row public.student_streaks;
  _new_streak INTEGER;
  _is_new_day BOOLEAN := false;
  _counts_toward_streak BOOLEAN;
  _freeze_used BOOLEAN := false;
  _avail INTEGER;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  _counts_toward_streak := _activity_type IN (
    'practice_question_solved',
    'practice_set_completed',
    'mock_test_attempted',
    'coding_question_solved',
    'daily_challenge_completed',
    'homework_submitted'
  );

  INSERT INTO public.student_streaks(user_id, current_streak, longest_streak, last_activity_date, today_completed)
  VALUES (_uid, 0, 0, NULL, false)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO _row FROM public.student_streaks WHERE user_id = _uid FOR UPDATE;

  IF _row.last_freeze_grant_month IS NULL OR _row.last_freeze_grant_month < _month_start THEN
    UPDATE public.student_streaks
      SET streak_freezes_available = 1,
          last_freeze_grant_month = _month_start
      WHERE user_id = _uid;
    _row.streak_freezes_available := 1;
    _row.last_freeze_grant_month := _month_start;
  END IF;

  IF NOT _counts_toward_streak THEN
    INSERT INTO public.streak_activity_logs(user_id, activity_date, activity_type, activity_reference_id, streak_count_after_activity, points_earned)
    VALUES (_uid, _today, _activity_type, _reference_id, COALESCE(_row.current_streak, 0), 0);

    RETURN QUERY SELECT
      COALESCE(_row.current_streak, 0),
      COALESCE(_row.longest_streak, 0),
      COALESCE(_row.today_completed, false),
      false,
      false,
      COALESCE(_row.streak_freezes_available, 0);
    RETURN;
  END IF;

  IF _row.last_activity_date = _today THEN
    _new_streak := _row.current_streak;
  ELSIF _row.last_activity_date = _today - INTERVAL '1 day' THEN
    _new_streak := _row.current_streak + 1;
    _is_new_day := true;
  ELSIF _row.last_activity_date IS NOT NULL AND COALESCE(_row.streak_freezes_available, 0) > 0
        AND (_today - _row.last_activity_date) = 2 THEN
    _new_streak := _row.current_streak + 1;
    _is_new_day := true;
    _freeze_used := true;
  ELSE
    _new_streak := 1;
    _is_new_day := true;
  END IF;

  UPDATE public.student_streaks
  SET current_streak = _new_streak,
      longest_streak = GREATEST(longest_streak, _new_streak),
      last_activity_date = _today,
      today_completed = true,
      streak_freezes_available = CASE WHEN _freeze_used THEN GREATEST(streak_freezes_available - 1, 0) ELSE streak_freezes_available END,
      streak_freezes_used = CASE WHEN _freeze_used THEN streak_freezes_used + 1 ELSE streak_freezes_used END,
      last_freeze_used_at = CASE WHEN _freeze_used THEN now() ELSE last_freeze_used_at END
  WHERE user_id = _uid
  RETURNING streak_freezes_available INTO _avail;

  INSERT INTO public.streak_activity_logs(user_id, activity_date, activity_type, activity_reference_id, streak_count_after_activity, points_earned)
  VALUES (_uid, _today, _activity_type, _reference_id, _new_streak, 10);

  RETURN QUERY SELECT _new_streak,
    GREATEST(_row.longest_streak, _new_streak),
    true,
    _is_new_day,
    _freeze_used,
    COALESCE(_avail, 0);
END;
$function$;

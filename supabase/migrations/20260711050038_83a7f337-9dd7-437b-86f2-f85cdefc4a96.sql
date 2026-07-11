CREATE OR REPLACE FUNCTION public.record_streak_activity(_activity_type text, _reference_id text DEFAULT NULL::text)
 RETURNS TABLE(current_streak integer, longest_streak integer, today_completed boolean, is_new_day boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid UUID := auth.uid();
  _today DATE := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  _row public.student_streaks;
  _new_streak INTEGER;
  _is_new_day BOOLEAN := false;
  _counts_toward_streak BOOLEAN;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Any meaningful student action advances the streak. The Practice UI has
  -- been retired, so counting only 'practice_question_solved' would freeze
  -- every streak. Login pings, mock attempts, homework submissions, coding
  -- solves and daily challenges all count as "engaged today".
  _counts_toward_streak := _activity_type IN (
    'login',
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

  IF NOT _counts_toward_streak THEN
    INSERT INTO public.streak_activity_logs(user_id, activity_date, activity_type, activity_reference_id, streak_count_after_activity, points_earned)
    VALUES (_uid, _today, _activity_type, _reference_id, _row.current_streak, 0);

    RETURN QUERY SELECT
      COALESCE(_row.current_streak, 0),
      COALESCE(_row.longest_streak, 0),
      COALESCE(_row.today_completed, false),
      false;
    RETURN;
  END IF;

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
$function$;
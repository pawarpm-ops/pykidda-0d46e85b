CREATE OR REPLACE FUNCTION public.reset_teacher_dashboard_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _counts jsonb := '{}'::jsonb;
  _n bigint;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_role(_uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.mock_results;           GET DIAGNOSTICS _n = ROW_COUNT;
  _counts := _counts || jsonb_build_object('mock_results', _n);

  DELETE FROM public.streak_activity_logs;   GET DIAGNOSTICS _n = ROW_COUNT;
  _counts := _counts || jsonb_build_object('streak_activity_logs', _n);

  DELETE FROM public.student_streaks;        GET DIAGNOSTICS _n = ROW_COUNT;
  _counts := _counts || jsonb_build_object('student_streaks', _n);

  DELETE FROM public.leaderboard_scores;     GET DIAGNOSTICS _n = ROW_COUNT;
  _counts := _counts || jsonb_build_object('leaderboard_scores', _n);

  DELETE FROM public.student_badges;         GET DIAGNOSTICS _n = ROW_COUNT;
  _counts := _counts || jsonb_build_object('student_badges', _n);

  DELETE FROM public.mock_test_attempt_comments; GET DIAGNOSTICS _n = ROW_COUNT;
  _counts := _counts || jsonb_build_object('mock_test_attempt_comments', _n);

  DELETE FROM public.ai_mock_attempts;       GET DIAGNOSTICS _n = ROW_COUNT;
  _counts := _counts || jsonb_build_object('ai_mock_attempts', _n);

  DELETE FROM public.admin_activity_logs;    GET DIAGNOSTICS _n = ROW_COUNT;
  _counts := _counts || jsonb_build_object('admin_activity_logs', _n);

  RETURN jsonb_build_object('ok', true, 'cleared', _counts);
END;
$function$;

REVOKE ALL ON FUNCTION public.reset_teacher_dashboard_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_teacher_dashboard_data() TO authenticated;
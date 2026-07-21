CREATE OR REPLACE FUNCTION public.get_public_student_profile(_public_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p public.profiles;
  s public.student_streaks;
  lb public.leaderboard_scores;
  settings jsonb;
  practice_solved int := 0;
  units_completed int[] := ARRAY[]::int[];
  result jsonb;
  rank_row int;
BEGIN
  IF _public_id IS NULL OR length(_public_id) < 6 OR length(_public_id) > 64 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO p FROM public.profiles WHERE public_profile_id = _public_id;
  IF NOT FOUND OR p.qr_enabled = false THEN
    RETURN NULL;
  END IF;

  settings := COALESCE(p.public_profile_settings, '{}'::jsonb);

  SELECT * INTO s FROM public.student_streaks WHERE user_id = p.id;
  SELECT * INTO lb FROM public.leaderboard_scores WHERE user_id = p.id;

  -- Practice attempts are no longer persisted; report zero/empty.
  practice_solved := 0;
  units_completed := ARRAY[]::int[];

  IF lb.user_id IS NOT NULL THEN
    SELECT rnk INTO rank_row FROM (
      SELECT user_id, DENSE_RANK() OVER (ORDER BY score DESC NULLS LAST) AS rnk
      FROM public.leaderboard_scores
    ) x WHERE x.user_id = p.id;
  END IF;

  result := jsonb_build_object(
    'public_profile_id', p.public_profile_id,
    'student_unique_id', p.student_unique_id,
    'display_name', COALESCE(p.display_name, 'Anonymous kidda'),
    'bio', p.bio,
    'settings', settings,
    'joined_at', p.created_at
  );

  IF COALESCE((settings->>'showAvatar')::boolean, false) THEN
    result := result || jsonb_build_object('avatar_url', p.avatar_url);
  END IF;

  IF COALESCE((settings->>'showClass')::boolean, false) THEN
    result := result || jsonb_build_object('college_name', p.college_name);
  END IF;

  IF COALESCE((settings->>'showStreak')::boolean, false) THEN
    result := result || jsonb_build_object(
      'current_streak', COALESCE(s.current_streak, 0),
      'longest_streak', COALESCE(s.longest_streak, 0)
    );
  END IF;

  IF COALESCE((settings->>'showLeaderboardRank')::boolean, false) THEN
    result := result || jsonb_build_object(
      'leaderboard_rank', rank_row,
      'leaderboard_score', COALESCE(lb.score, 0)
    );
  END IF;

  IF COALESCE((settings->>'showCompletedUnits')::boolean, false) THEN
    result := result || jsonb_build_object(
      'units_completed', to_jsonb(units_completed),
      'practice_solved', practice_solved,
      'mocks_taken', COALESCE(lb.mocks_taken, 0),
      'mock_best', COALESCE(lb.mock_best, 0)
    );
  END IF;

  IF COALESCE((settings->>'showBadges')::boolean, false) THEN
    result := result || jsonb_build_object('badges', jsonb_build_object(
      'streak_7', COALESCE(s.longest_streak, 0) >= 7,
      'streak_30', COALESCE(s.longest_streak, 0) >= 30,
      'solver_10', practice_solved >= 10,
      'solver_25', practice_solved >= 25,
      'mock_ace', COALESCE(lb.mock_best, 0) >= 80
    ));
  END IF;

  RETURN result;
END;
$function$;
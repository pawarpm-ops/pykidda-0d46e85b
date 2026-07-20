
-- 1) Fix the actual leak: add caller-identity check inside compute_badge_metrics
CREATE OR REPLACE FUNCTION public.compute_badge_metrics(_user_id uuid)
 RETURNS TABLE(practice_solved integer, tests_passed integer, distinct_units integer, clean_sweep_count integer, hard_solved integer, diff_mix integer, bug_hunter_count integer, never_give_up boolean, comeback boolean, longest_streak integer, mock_count integer, mock_best integer, mock_improve_15 integer, mock_personal_best boolean, mock_rising integer, homework_on_time integer, homework_perfect integer, homework_correction integer, homework_complete integer, homework_early integer, first_activity integer, first_code_run integer, all_rounder boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _has_practice boolean;
  _has_homework boolean;
  _has_mock boolean;
BEGIN
  -- Only the owner or an admin may read another user's badge metrics.
  IF auth.uid() IS NULL OR (_user_id <> auth.uid() AND NOT public.has_role(auth.uid(),'admin'::public.app_role)) THEN
    RETURN;
  END IF;

  SELECT COUNT(DISTINCT question_id)::int INTO practice_solved
    FROM public.practice_attempts WHERE user_id = _user_id AND solved = true;

  SELECT COALESCE(SUM(passed),0)::int INTO tests_passed
    FROM public.practice_attempts WHERE user_id = _user_id AND solved = true;

  SELECT COUNT(DISTINCT unit)::int INTO distinct_units
    FROM public.practice_attempts WHERE user_id = _user_id;

  SELECT COUNT(*)::int INTO clean_sweep_count
    FROM (
      SELECT question_id,
             (array_agg(solved ORDER BY attempted_at ASC))[1] AS first_solved,
             (array_agg(passed  ORDER BY attempted_at ASC))[1] AS first_passed,
             (array_agg(total   ORDER BY attempted_at ASC))[1] AS first_total
      FROM public.practice_attempts WHERE user_id = _user_id
      GROUP BY question_id
    ) x
    WHERE first_solved = true AND first_total > 0 AND first_passed = first_total;

  SELECT COUNT(DISTINCT pa.question_id)::int INTO hard_solved
    FROM public.practice_attempts pa
    JOIN public.practice_questions pq ON pq.id::text = pa.question_id
    WHERE pa.user_id = _user_id AND pa.solved = true AND pq.difficulty = 'hard';

  SELECT COUNT(DISTINCT COALESCE(pq.difficulty,'unknown'))::int INTO diff_mix
    FROM public.practice_attempts pa
    JOIN public.practice_questions pq ON pq.id::text = pa.question_id
    WHERE pa.user_id = _user_id AND pa.solved = true AND pq.difficulty IN ('easy','medium','hard');

  SELECT COUNT(*)::int INTO bug_hunter_count FROM (
    SELECT question_id
    FROM public.practice_attempts
    WHERE user_id = _user_id
    GROUP BY question_id
    HAVING bool_or(solved = false) AND bool_or(solved = true)
       AND MIN(attempted_at) FILTER (WHERE solved = false)
         < MAX(attempted_at) FILTER (WHERE solved = true)
  ) t;

  SELECT EXISTS (
    SELECT 1 FROM public.practice_attempts
    WHERE user_id = _user_id
    GROUP BY question_id
    HAVING COUNT(*) FILTER (WHERE solved = false) >= 3 AND bool_or(solved = true)
  ) INTO never_give_up;

  SELECT EXISTS (
    SELECT 1 FROM public.practice_attempts
    WHERE user_id = _user_id
    GROUP BY question_id
    HAVING bool_or(solved = true)
       AND (MAX(attempted_at) FILTER (WHERE solved = true) - MIN(attempted_at)) > INTERVAL '24 hours'
  ) INTO comeback;

  SELECT COALESCE(MAX(ss.longest_streak),0)::int INTO longest_streak
    FROM public.student_streaks ss WHERE ss.user_id = _user_id;

  SELECT COUNT(*)::int INTO mock_count FROM public.mock_results WHERE user_id = _user_id;
  SELECT COALESCE(MAX(percentage),0)::int INTO mock_best FROM public.mock_results WHERE user_id = _user_id;

  SELECT COALESCE(MAX(latest - earliest),0)::int INTO mock_improve_15 FROM (
    SELECT test_id,
      (array_agg(percentage ORDER BY submitted_at ASC))[1] AS earliest,
      (array_agg(percentage ORDER BY submitted_at DESC))[1] AS latest
    FROM public.mock_results WHERE user_id = _user_id
    GROUP BY test_id
    HAVING COUNT(*) >= 2
  ) t;

  SELECT EXISTS (
    SELECT 1 FROM (
      SELECT percentage,
        MAX(percentage) OVER (ORDER BY submitted_at ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS prev_best
      FROM public.mock_results WHERE user_id = _user_id
    ) t WHERE prev_best IS NOT NULL AND percentage > prev_best
  ) INTO mock_personal_best;

  WITH ordered AS (
    SELECT percentage, ROW_NUMBER() OVER (ORDER BY submitted_at ASC) AS rn
    FROM public.mock_results WHERE user_id = _user_id
  ),
  with_prev AS (
    SELECT rn, percentage, LAG(percentage) OVER (ORDER BY rn) AS prev_pct
    FROM ordered
  ),
  flagged AS (
    SELECT rn, percentage,
      CASE WHEN prev_pct IS NULL OR percentage <= prev_pct THEN 1 ELSE 0 END AS reset_flag
    FROM with_prev
  ),
  grouped AS (
    SELECT rn, percentage, SUM(reset_flag) OVER (ORDER BY rn) AS grp
    FROM flagged
  )
  SELECT COALESCE(MAX(cnt),0)::int INTO mock_rising
  FROM (SELECT COUNT(*) AS cnt FROM grouped GROUP BY grp) x;

  SELECT COUNT(*)::int INTO homework_on_time
    FROM public.homework_submissions
    WHERE student_id = _user_id
      AND status IN ('submitted','checked','returned')
      AND is_late = false;

  SELECT COUNT(*)::int INTO homework_perfect FROM (
    SELECT hs.id
    FROM public.homework_submissions hs
    JOIN public.homework h ON h.id = hs.homework_id
    WHERE hs.student_id = _user_id
      AND hs.status IN ('checked','returned')
      AND h.total_marks > 0
      AND hs.total_marks_obtained IS NOT NULL
      AND hs.total_marks_obtained >= h.total_marks
  ) t;

  homework_correction := 0;

  SELECT COUNT(*)::int INTO homework_complete FROM (
    SELECT hs.id
    FROM public.homework_submissions hs
    JOIN public.homework h ON h.id = hs.homework_id
    WHERE hs.student_id = _user_id
      AND hs.status IN ('submitted','late','checked','returned')
      AND (SELECT COUNT(*) FROM public.homework_questions hq WHERE hq.homework_id = h.id) =
          (SELECT COUNT(*) FROM public.homework_question_answers a WHERE a.submission_id = hs.id
             AND ((a.student_answer IS NOT NULL AND length(trim(a.student_answer))>0)
                  OR (a.student_code IS NOT NULL AND length(trim(a.student_code))>0)))
  ) t;

  SELECT COUNT(*)::int INTO homework_early
    FROM public.homework_submissions hs
    JOIN public.homework h ON h.id = hs.homework_id
    WHERE hs.student_id = _user_id
      AND h.due_at IS NOT NULL
      AND hs.submitted_at IS NOT NULL
      AND hs.submitted_at <= h.due_at - INTERVAL '24 hours';

  SELECT COUNT(*)::int INTO first_activity
    FROM public.streak_activity_logs WHERE user_id = _user_id;

  SELECT COUNT(*)::int INTO first_code_run
    FROM public.practice_attempts WHERE user_id = _user_id;

  SELECT EXISTS(SELECT 1 FROM public.practice_attempts WHERE user_id=_user_id AND solved=true) INTO _has_practice;
  SELECT EXISTS(SELECT 1 FROM public.homework_submissions WHERE student_id=_user_id AND status IN ('submitted','late','checked','returned')) INTO _has_homework;
  SELECT EXISTS(SELECT 1 FROM public.mock_results WHERE user_id=_user_id) INTO _has_mock;
  all_rounder := _has_practice AND _has_homework AND _has_mock;

  RETURN NEXT;
END; $function$;

-- 2) Defense in depth: revoke anon EXECUTE on SECURITY DEFINER functions
-- that already require auth.uid() or a role internally. get_public_student_profile
-- (public QR profile) and log_system_health_event (pre-auth login error logging)
-- stay anon-executable by design.
REVOKE EXECUTE ON FUNCTION public.compute_badge_metrics(uuid)          FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_badge_overview()               FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.evaluate_and_award_badges(text)      FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_badge_progress(uuid)             FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_next_badge_targets(integer)      FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid, public.app_role[]) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid)                 FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_badges_for_student(uuid)        FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_streak_activity(text, text)   FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.system_health_summary()              FROM anon, PUBLIC;

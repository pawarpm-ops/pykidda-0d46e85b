-- Rewrite badge functions to remove references to the dropped practice_attempts table.
-- Practice metrics now always return 0/false since practice attempts are no longer persisted.

CREATE OR REPLACE FUNCTION public.compute_badge_metrics(_user_id uuid)
 RETURNS TABLE(practice_solved integer, tests_passed integer, distinct_units integer, clean_sweep_count integer, hard_solved integer, diff_mix integer, bug_hunter_count integer, never_give_up boolean, comeback boolean, longest_streak integer, mock_count integer, mock_best integer, mock_improve_15 integer, mock_personal_best boolean, mock_rising integer, homework_on_time integer, homework_perfect integer, homework_correction integer, homework_complete integer, homework_early integer, first_activity integer, first_code_run integer, all_rounder boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _has_homework boolean;
  _has_mock boolean;
BEGIN
  IF auth.uid() IS NULL OR (_user_id <> auth.uid() AND NOT public.has_role(auth.uid(),'admin'::public.app_role)) THEN
    RETURN;
  END IF;

  -- Practice attempts are no longer persisted; practice-derived metrics are zeroed.
  practice_solved := 0;
  tests_passed := 0;
  distinct_units := 0;
  clean_sweep_count := 0;
  hard_solved := 0;
  diff_mix := 0;
  bug_hunter_count := 0;
  never_give_up := false;
  comeback := false;

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

  -- first_code_run was previously derived from practice_attempts; use streak
  -- activity logs relating to practice as the best available proxy.
  SELECT COUNT(*)::int INTO first_code_run
    FROM public.streak_activity_logs
    WHERE user_id = _user_id
      AND activity_type IN ('practice_opened','practice_question_solved','practice_set_completed','coding_question_solved');

  SELECT EXISTS(SELECT 1 FROM public.homework_submissions WHERE student_id=_user_id AND status IN ('submitted','late','checked','returned')) INTO _has_homework;
  SELECT EXISTS(SELECT 1 FROM public.mock_results WHERE user_id=_user_id) INTO _has_mock;
  all_rounder := _has_homework AND _has_mock;

  RETURN NEXT;
END; $function$;

-- Rewrite evaluate_and_award_badges to remove the practice_attempts subquery
-- for 'unit_conqueror'. That badge now falls back to distinct_units (0 while
-- practice attempts aren't persisted, so it won't award — which matches the
-- new "practice is not persisted" product decision).

CREATE OR REPLACE FUNCTION public.evaluate_and_award_badges(_event_type text DEFAULT NULL::text)
 RETURNS TABLE(badge_key text, badge_name text, description text, icon text, earned_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  m record;
  b record;
  hit boolean;
  val int;
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  SELECT * INTO m FROM public.compute_badge_metrics(_uid);

  FOR b IN SELECT * FROM public.badges LOOP
    hit := false; val := NULL;
    CASE b.badge_key
      WHEN 'first_step'        THEN hit := m.first_activity  >= 1;                val := m.first_activity;
      WHEN 'hello_python'      THEN hit := m.first_code_run  >= 1;                val := m.first_code_run;
      WHEN 'first_solution'    THEN hit := m.practice_solved >= 1;                val := m.practice_solved;
      WHEN 'homework_starter'  THEN hit := EXISTS(SELECT 1 FROM public.homework_submissions WHERE student_id=_uid AND status IN ('submitted','late','checked','returned')); val := 1;
      WHEN 'mock_explorer'     THEN hit := m.mock_count      >= 1;                val := m.mock_count;
      WHEN 'spark'             THEN hit := m.longest_streak  >= 3;                val := m.longest_streak;
      WHEN 'flame_keeper'      THEN hit := m.longest_streak  >= 7;                val := m.longest_streak;
      WHEN 'momentum'          THEN hit := m.longest_streak  >= 14;               val := m.longest_streak;
      WHEN 'python_warrior'    THEN hit := m.longest_streak  >= 30;               val := m.longest_streak;
      WHEN 'unstoppable'       THEN hit := m.longest_streak  >= 60;               val := m.longest_streak;
      WHEN 'century_coder'     THEN hit := m.longest_streak  >= 100;              val := m.longest_streak;
      WHEN 'practice_rookie'   THEN hit := m.practice_solved >= 5;                val := m.practice_solved;
      WHEN 'practice_explorer' THEN hit := m.practice_solved >= 15;               val := m.practice_solved;
      WHEN 'practice_pro'      THEN hit := m.practice_solved >= 30;               val := m.practice_solved;
      WHEN 'practice_champion' THEN hit := m.practice_solved >= 60;               val := m.practice_solved;
      WHEN 'practice_legend'   THEN hit := m.practice_solved >= 100;              val := m.practice_solved;
      WHEN 'unit_conqueror'    THEN hit := false;                                 val := m.distinct_units;
      WHEN 'python_explorer'   THEN hit := m.distinct_units >= 5;                 val := m.distinct_units;
      WHEN 'clean_sweep'       THEN hit := m.clean_sweep_count >= 1;              val := m.clean_sweep_count;
      WHEN 'test_tamer'        THEN hit := m.tests_passed    >= 50;               val := m.tests_passed;
      WHEN 'test_master'       THEN hit := m.tests_passed    >= 250;              val := m.tests_passed;
      WHEN 'bug_hunter'        THEN hit := m.bug_hunter_count >= 1;               val := m.bug_hunter_count;
      WHEN 'debug_detective'   THEN hit := m.bug_hunter_count >= 10;              val := m.bug_hunter_count;
      WHEN 'never_give_up'     THEN hit := m.never_give_up;                       val := CASE WHEN m.never_give_up THEN 1 ELSE 0 END;
      WHEN 'comeback_coder'    THEN hit := m.comeback;                            val := CASE WHEN m.comeback THEN 1 ELSE 0 END;
      WHEN 'growth_mindset'    THEN hit := m.mock_improve_15 >= 15;               val := m.mock_improve_15;
      WHEN 'personal_best'     THEN hit := m.mock_personal_best;                  val := CASE WHEN m.mock_personal_best THEN 1 ELSE 0 END;
      WHEN 'on_time'           THEN hit := m.homework_on_time >= 1;               val := m.homework_on_time;
      WHEN 'homework_hero'     THEN hit := m.homework_on_time >= 5;               val := m.homework_on_time;
      WHEN 'deadline_defender' THEN hit := m.homework_on_time >= 15;              val := m.homework_on_time;
      WHEN 'homework_master'   THEN hit := m.homework_on_time >= 30;              val := m.homework_on_time;
      WHEN 'perfect_submission'THEN hit := m.homework_perfect >= 1;               val := m.homework_perfect;
      WHEN 'complete_thinker'  THEN hit := m.homework_complete >= 1;              val := m.homework_complete;
      WHEN 'mock_starter'      THEN hit := m.mock_count >= 1;                     val := m.mock_count;
      WHEN 'focused_learner'   THEN hit := m.mock_count >= 5;                     val := m.mock_count;
      WHEN 'exam_ready'        THEN hit := m.mock_count >= 10;                    val := m.mock_count;
      WHEN 'mock_marathon'     THEN hit := m.mock_count >= 25;                    val := m.mock_count;
      WHEN 'accuracy_ace'      THEN hit := m.mock_best  >= 80;                    val := m.mock_best;
      WHEN 'python_scholar'    THEN hit := m.mock_best  >= 90;                    val := m.mock_best;
      WHEN 'perfect_score'     THEN hit := m.mock_best  >= 100;                   val := m.mock_best;
      WHEN 'rising_star'       THEN hit := m.mock_rising >= 3;                    val := m.mock_rising;
      WHEN 'challenge_accepted'THEN hit := m.hard_solved >= 1;                    val := m.hard_solved;
      WHEN 'difficulty_climber'THEN hit := m.diff_mix   >= 3;                     val := m.diff_mix;
      WHEN 'all_rounder'       THEN hit := m.all_rounder;                         val := CASE WHEN m.all_rounder THEN 3 ELSE 0 END;
      WHEN 'early_finisher'    THEN hit := m.homework_early >= 1;                 val := m.homework_early;
      ELSE hit := false;
    END CASE;

    IF hit THEN
      INSERT INTO public.student_badges (student_id, badge_id, source_type, metric_value, trigger_activity)
      VALUES (_uid, b.id, _event_type, val, _event_type)
      ON CONFLICT (student_id, badge_id) DO NOTHING;
      IF FOUND THEN
        RETURN QUERY SELECT b.badge_key, b.badge_name, b.description, b.icon, now();
      END IF;
    END IF;
  END LOOP;
  RETURN;
END; $function$;

-- Rewrite get_badge_progress to remove practice_attempts subquery.

CREATE OR REPLACE FUNCTION public.get_badge_progress(_user_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(badge_key text, badge_name text, description text, icon text, category text, tier text, rarity text, is_secret boolean, target_value integer, motivational_message text, unlock_hint text, sort_order integer, current_value integer, progress_pct integer, earned boolean, earned_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := COALESCE(_user_id, auth.uid());
  m record;
  b record;
  v int;
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  IF _uid <> auth.uid() AND NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
    RETURN;
  END IF;

  SELECT * INTO m FROM public.compute_badge_metrics(_uid);

  FOR b IN SELECT * FROM public.badges ORDER BY sort_order LOOP
    v := 0;
    CASE b.badge_key
      WHEN 'first_step'        THEN v := m.first_activity;
      WHEN 'hello_python'      THEN v := m.first_code_run;
      WHEN 'first_solution'    THEN v := m.practice_solved;
      WHEN 'homework_starter'  THEN v := LEAST(m.homework_on_time + m.homework_complete, 1);
      WHEN 'mock_explorer'     THEN v := m.mock_count;
      WHEN 'spark','flame_keeper','momentum','python_warrior','unstoppable','century_coder' THEN v := m.longest_streak;
      WHEN 'practice_rookie','practice_explorer','practice_pro','practice_champion','practice_legend' THEN v := m.practice_solved;
      WHEN 'unit_conqueror'    THEN v := 0;
      WHEN 'python_explorer'   THEN v := m.distinct_units;
      WHEN 'clean_sweep'       THEN v := m.clean_sweep_count;
      WHEN 'test_tamer','test_master' THEN v := m.tests_passed;
      WHEN 'bug_hunter','debug_detective' THEN v := m.bug_hunter_count;
      WHEN 'never_give_up'     THEN v := CASE WHEN m.never_give_up THEN 1 ELSE 0 END;
      WHEN 'comeback_coder'    THEN v := CASE WHEN m.comeback THEN 1 ELSE 0 END;
      WHEN 'growth_mindset'    THEN v := m.mock_improve_15;
      WHEN 'personal_best'     THEN v := CASE WHEN m.mock_personal_best THEN 1 ELSE 0 END;
      WHEN 'on_time','homework_hero','deadline_defender','homework_master' THEN v := m.homework_on_time;
      WHEN 'perfect_submission'THEN v := m.homework_perfect;
      WHEN 'complete_thinker'  THEN v := m.homework_complete;
      WHEN 'mock_starter','focused_learner','exam_ready','mock_marathon' THEN v := m.mock_count;
      WHEN 'accuracy_ace','python_scholar','perfect_score' THEN v := m.mock_best;
      WHEN 'rising_star'       THEN v := m.mock_rising;
      WHEN 'challenge_accepted'THEN v := m.hard_solved;
      WHEN 'difficulty_climber'THEN v := m.diff_mix;
      WHEN 'all_rounder'       THEN v := CASE WHEN m.all_rounder THEN 3 ELSE (CASE WHEN m.mock_count>0 THEN 1 ELSE 0 END + CASE WHEN m.homework_on_time>0 THEN 1 ELSE 0 END) END;
      WHEN 'early_finisher'    THEN v := m.homework_early;
      ELSE v := 0;
    END CASE;

    badge_key := b.badge_key;
    badge_name := b.badge_name;
    description := b.description;
    icon := b.icon;
    category := b.category;
    tier := b.tier;
    rarity := b.rarity;
    is_secret := b.is_secret;
    target_value := b.target_value;
    motivational_message := b.motivational_message;
    unlock_hint := b.unlock_hint;
    sort_order := b.sort_order;
    current_value := LEAST(v, COALESCE(b.target_value, v));
    progress_pct := CASE WHEN COALESCE(b.target_value,0) > 0
                          THEN LEAST(100, (v * 100) / b.target_value) ELSE 0 END;

    SELECT sb.earned_at INTO earned_at
      FROM public.student_badges sb WHERE sb.student_id=_uid AND sb.badge_id=b.id;
    earned := earned_at IS NOT NULL;

    RETURN NEXT;
  END LOOP;
  RETURN;
END; $function$;
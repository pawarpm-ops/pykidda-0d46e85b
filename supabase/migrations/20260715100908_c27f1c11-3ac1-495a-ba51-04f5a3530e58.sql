
-- 1. Extend badges catalogue
ALTER TABLE public.badges
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'getting_started',
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'bronze',
  ADD COLUMN IF NOT EXISTS rarity text NOT NULL DEFAULT 'common',
  ADD COLUMN IF NOT EXISTS is_secret boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS target_value integer,
  ADD COLUMN IF NOT EXISTS motivational_message text,
  ADD COLUMN IF NOT EXISTS unlock_hint text;

ALTER TABLE public.badges DROP CONSTRAINT IF EXISTS badges_tier_chk;
ALTER TABLE public.badges DROP CONSTRAINT IF EXISTS badges_rarity_chk;
ALTER TABLE public.badges DROP CONSTRAINT IF EXISTS badges_category_chk;
ALTER TABLE public.badges
  ADD CONSTRAINT badges_tier_chk CHECK (tier IN ('bronze','silver','gold','platinum','legendary')),
  ADD CONSTRAINT badges_rarity_chk CHECK (rarity IN ('common','uncommon','rare','epic','legendary')),
  ADD CONSTRAINT badges_category_chk CHECK (category IN ('getting_started','consistency','practice','debugging','homework','mock','exploration'));

ALTER TABLE public.student_badges
  ADD COLUMN IF NOT EXISTS metric_value integer,
  ADD COLUMN IF NOT EXISTS trigger_activity text;

INSERT INTO public.badges (badge_key, badge_name, description, icon, rule_type, threshold, sort_order, category, tier, rarity, target_value, motivational_message, unlock_hint, is_secret) VALUES
  ('first_step',        'First Step',        'You opened your first learning activity.',            'Rocket',          'first_activity',   1,   10, 'getting_started','bronze','common',   1, 'Every coder starts somewhere.',                      'Open any Practice, Homework or Mock activity.', false),
  ('hello_python',      'Hello Python',      'You ran Python code for the first time.',             'Terminal',        'first_code_run',   1,   11, 'getting_started','bronze','common',   1, 'Your journey begins with one line of code.',         'Run any Python snippet in a Practice question.', false),
  ('first_solution',    'First Solution',    'You passed your first Practice question.',            'CheckCircle2',    'practice_solved',  1,   12, 'getting_started','bronze','common',   1, 'Problem solved — the first of many.',                'Solve any Practice question.', false),
  ('homework_starter',  'Homework Starter',  'You submitted your first Homework.',                  'ClipboardCheck',  'first_homework',   1,   13, 'getting_started','bronze','common',   1, 'Consistency starts with the first submission.',      'Submit any Homework assignment.', false),
  ('mock_explorer',     'Mock Explorer',     'You completed your first Mock Test.',                 'ClipboardList',   'mock_taken',       1,   14, 'getting_started','bronze','common',   1, 'You just tested your skills — well done.',           'Complete any Mock Test.', false),
  ('spark',             'Spark',             '3-day learning streak.',                              'Sparkles',        'streak',           3,   20, 'consistency','bronze','common',       3, 'You are building a habit.',                          'Learn on 3 different days in a row.', false),
  ('flame_keeper',      'Flame Keeper',      '7-day learning streak.',                              'Flame',           'streak',           7,   21, 'consistency','silver','uncommon',    7, 'A whole week of focus.',                             'Learn on 7 different days in a row.', false),
  ('momentum',          'Momentum',          '14-day learning streak.',                             'Zap',             'streak',          14,   22, 'consistency','silver','uncommon',   14, 'Your momentum is real.',                             'Learn on 14 different days in a row.', false),
  ('python_warrior',    'Python Warrior',    '30-day learning streak.',                             'Shield',          'streak',          30,   23, 'consistency','gold','rare',         30, 'You have shown true discipline.',                    'Learn on 30 different days in a row.', false),
  ('unstoppable',       'Unstoppable',       '60-day learning streak.',                             'Rocket',          'streak',          60,   24, 'consistency','platinum','epic',     60, 'Almost nothing can stop you now.',                   'Learn on 60 different days in a row.', false),
  ('century_coder',     'Century Coder',     '100-day learning streak.',                            'Crown',           'streak',         100,   25, 'consistency','legendary','legendary',100,'A hundred days of learning. Legendary.',            'Learn on 100 different days in a row.', false),
  ('practice_rookie',   'Practice Rookie',   'Pass 5 Practice questions.',                          'Sprout',          'practice_solved',  5,   30, 'practice','bronze','common',        5, 'Small wins add up quickly.',                         'Pass any 5 Practice questions.', false),
  ('practice_explorer', 'Practice Explorer', 'Pass 15 Practice questions.',                         'Compass',         'practice_solved', 15,   31, 'practice','silver','uncommon',    15, 'You are exploring Python confidently.',              'Pass 15 Practice questions.', false),
  ('practice_pro',      'Practice Pro',      'Pass 30 Practice questions.',                         'Target',          'practice_solved', 30,   32, 'practice','gold','rare',          30, 'Your skills are clearly growing.',                   'Pass 30 Practice questions.', false),
  ('practice_champion', 'Practice Champion', 'Pass 60 Practice questions.',                         'Trophy',          'practice_solved', 60,   33, 'practice','platinum','epic',      60, 'Champion-level dedication.',                         'Pass 60 Practice questions.', false),
  ('practice_legend',   'Practice Legend',   'Pass 100 Practice questions.',                        'Award',           'practice_solved',100,   34, 'practice','legendary','legendary',100,'One hundred solves. Legendary.',                    'Pass 100 Practice questions.', false),
  ('unit_conqueror',    'Unit Conqueror',    'Complete every published question in one unit.',      'Flag',            'unit_complete',    1,   35, 'practice','gold','rare',          1, 'You mastered a whole unit.',                         'Pass every published question in any unit.', false),
  ('python_explorer',   'Python Explorer',   'Attempt questions from 5 different units.',           'Map',             'distinct_units',   5,   36, 'practice','silver','uncommon',    5, 'You are exploring the whole syllabus.',              'Attempt at least one question in 5 different units.', false),
  ('clean_sweep',       'Clean Sweep',       'Pass all test cases of a question on the first run.', 'Wand2',           'clean_sweep',      1,   37, 'practice','silver','uncommon',    1, 'Perfect on the first try — nice.',                   'Pass every test case of a Practice question on your first submission.', false),
  ('test_tamer',        'Test Tamer',        'Pass 50 total test cases across Practice.',           'CheckCheck',      'tests_passed',    50,   38, 'practice','silver','uncommon',   50, 'You keep beating those tests.',                      'Pass 50 test cases in Practice.', false),
  ('test_master',       'Test Master',       'Pass 250 total test cases across Practice.',          'Medal',           'tests_passed',   250,   39, 'practice','gold','rare',         250, 'Testing is second nature to you.',                   'Pass 250 test cases in Practice.', false),
  ('bug_hunter',        'Bug Hunter',        'Fix your first failing Practice question.',           'Bug',             'bug_hunter',       1,   40, 'debugging','bronze','common',     1, 'Debugging is a superpower.',                         'Pass a Practice question after a previous failed attempt on it.', false),
  ('debug_detective',   'Debug Detective',   'Fix 10 different failing Practice questions.',        'Search',          'debug_fixes',     10,   41, 'debugging','silver','uncommon',  10, 'Ten bugs down — many more to squash.',               'Turn 10 different failing attempts into a pass.', false),
  ('never_give_up',     'Never Give Up',     'Pass a question after at least 3 failed attempts.',   'Heart',           'never_give_up',    1,   42, 'debugging','silver','uncommon',   1, 'Persistence beats talent.',                          'Pass a Practice question after 3+ failed attempts.', false),
  ('comeback_coder',    'Comeback Coder',    'Return to an unfinished question and finish it.',     'Undo2',           'comeback',         1,   43, 'debugging','silver','uncommon',   1, 'You came back — and finished it.',                   'Complete a Practice question you first tried 24+ hours earlier.', false),
  ('growth_mindset',    'Growth Mindset',    'Improve a Mock Test score by 15% or more.',           'TrendingUp',      'mock_improve_15',  15,   44, 'debugging','gold','rare',         15, 'Growth is the real goal.',                           'Beat a previous Mock Test on the same test by 15 percentage points.', false),
  ('personal_best',     'Personal Best',     'Achieve a new highest Mock Test score.',              'Star',            'mock_personal_best',1,  45, 'debugging','silver','uncommon',   1, 'A new personal best. Enjoy it!',                     'Beat your previous best Mock Test percentage.', false),
  ('on_time',           'On Time',           'Submit a Homework before its deadline.',              'Clock',           'homework_on_time',  1,   50, 'homework','bronze','common',     1, 'Deadlines respected.',                               'Submit any Homework before its due date.', false),
  ('homework_hero',     'Homework Hero',     'Submit 5 Homework assignments on time.',              'Shield',          'homework_on_time',  5,   51, 'homework','silver','uncommon',   5, 'Consistent homework wins.',                          'Submit 5 Homework assignments before their deadline.', false),
  ('deadline_defender', 'Deadline Defender', 'Submit 15 Homework assignments on time.',             'ShieldCheck',     'homework_on_time', 15,   52, 'homework','gold','rare',        15, 'Deadlines cannot catch you.',                        'Submit 15 Homework assignments on time.', false),
  ('homework_master',   'Homework Master',   'Submit 30 Homework assignments on time.',             'Crown',           'homework_on_time', 30,   53, 'homework','platinum','epic',    30, 'Homework mastery unlocked.',                         'Submit 30 Homework assignments on time.', false),
  ('perfect_submission','Perfect Submission','Earn full marks on a Homework.',                      'Sparkles',        'homework_perfect',  1,   54, 'homework','gold','rare',         1, 'Full marks — outstanding.',                          'Earn 100% marks on any checked Homework.', false),
  ('correction_champion','Correction Champion','Improve and resubmit a returned Homework.',         'RefreshCcw',      'homework_correction',1,  55, 'homework','silver','uncommon',   1, 'You listened and improved.',                         'Improve marks on a returned Homework after resubmission.', false),
  ('complete_thinker',  'Complete Thinker',  'Answer every question before submitting a Homework.', 'ListChecks',      'homework_complete', 1,   56, 'homework','bronze','common',     1, 'You leave nothing blank.',                           'Submit a Homework with all its questions answered.', false),
  ('mock_starter',      'Mock Starter',      'Complete your first Mock Test.',                      'Play',            'mock_taken',        1,   60, 'mock','bronze','common',         1, 'Mock tests build real confidence.',                  'Complete any Mock Test.', false),
  ('focused_learner',   'Focused Learner',   'Complete 5 Mock Tests.',                              'Brain',           'mock_taken',        5,   61, 'mock','silver','uncommon',       5, 'Focus pays off.',                                    'Complete 5 Mock Tests.', false),
  ('exam_ready',        'Exam Ready',        'Complete 10 Mock Tests.',                             'BookOpenCheck',   'mock_taken',       10,   62, 'mock','gold','rare',            10, 'Ten mocks — you are exam ready.',                    'Complete 10 Mock Tests.', false),
  ('mock_marathon',     'Mock Marathon',     'Complete 25 Mock Tests.',                             'Trophy',          'mock_taken',       25,   63, 'mock','platinum','epic',        25, 'Marathon runner of mock tests.',                     'Complete 25 Mock Tests.', false),
  ('accuracy_ace',      'Accuracy Ace',      'Score 80% or higher on a Mock Test.',                 'Target',          'mock_score',       80,   64, 'mock','silver','uncommon',      80, 'Precision matters — well done.',                     'Score at least 80% on a Mock Test.', false),
  ('python_scholar',    'Python Scholar',    'Score 90% or higher on a Mock Test.',                 'GraduationCap',   'mock_score',       90,   65, 'mock','gold','rare',            90, 'Scholarly work.',                                    'Score at least 90% on a Mock Test.', false),
  ('perfect_score',     'Perfect Score',     'Score 100% on a Mock Test.',                          'Crown',           'mock_score',      100,   66, 'mock','legendary','legendary', 100, 'Perfection. Enjoy it!',                              'Score 100% on any Mock Test.', false),
  ('rising_star',       'Rising Star',       'Improve across three consecutive Mock Tests.',        'TrendingUp',      'mock_rising',       3,   67, 'mock','gold','rare',             3, 'You are on a roll.',                                 'Improve your Mock Test score three times in a row.', false),
  ('challenge_accepted','Challenge Accepted','Complete a hard-difficulty Practice question.',      'Swords',          'hard_solved',       1,   70, 'exploration','silver','uncommon',1, 'Hard problems make strong coders.',                  'Pass any hard-difficulty Practice question.', false),
  ('difficulty_climber','Difficulty Climber','Complete easy, medium and hard Practice questions.', 'Mountain',        'difficulty_mix',    3,   71, 'exploration','gold','rare',       3, 'You handle every level.',                            'Pass at least one easy, one medium and one hard Practice question.', false),
  ('all_rounder',       'All-Rounder',       'Complete Practice, Homework and Mock activities.',   'Layers',          'all_rounder',       3,   72, 'exploration','silver','uncommon',3, 'A true all-rounder.',                                'Complete at least one Practice, one Homework and one Mock activity.', false),
  ('early_finisher',    'Early Finisher',    'Submit a Homework 24+ hours before its deadline.',   'Clock8',          'homework_early',    1,   73, 'exploration','silver','uncommon',1, 'Early birds win.',                                   'Submit a Homework at least 24 hours before its deadline.', false)
ON CONFLICT (badge_key) DO UPDATE SET
  badge_name = EXCLUDED.badge_name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  rule_type = EXCLUDED.rule_type,
  threshold = EXCLUDED.threshold,
  sort_order = EXCLUDED.sort_order,
  category = EXCLUDED.category,
  tier = EXCLUDED.tier,
  rarity = EXCLUDED.rarity,
  target_value = EXCLUDED.target_value,
  motivational_message = EXCLUDED.motivational_message,
  unlock_hint = EXCLUDED.unlock_hint,
  is_secret = EXCLUDED.is_secret;

CREATE OR REPLACE FUNCTION public.compute_badge_metrics(_user_id uuid)
RETURNS TABLE(
  practice_solved int,
  tests_passed int,
  distinct_units int,
  clean_sweep_count int,
  hard_solved int,
  diff_mix int,
  bug_hunter_count int,
  never_give_up boolean,
  comeback boolean,
  longest_streak int,
  mock_count int,
  mock_best int,
  mock_improve_15 int,
  mock_personal_best boolean,
  mock_rising int,
  homework_on_time int,
  homework_perfect int,
  homework_correction int,
  homework_complete int,
  homework_early int,
  first_activity int,
  first_code_run int,
  all_rounder boolean
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _has_practice boolean;
  _has_homework boolean;
  _has_mock boolean;
BEGIN
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

  -- mock_rising: longest run of strictly-increasing consecutive percentages
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
END; $$;

GRANT EXECUTE ON FUNCTION public.compute_badge_metrics(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.evaluate_and_award_badges(_event_type text DEFAULT NULL::text)
RETURNS TABLE(badge_key text, badge_name text, description text, icon text, earned_at timestamp with time zone)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
      WHEN 'unit_conqueror'    THEN hit := EXISTS(
          SELECT 1 FROM (
            SELECT pq.unit,
              COUNT(*) FILTER (WHERE pq.status='published') AS total_q,
              COUNT(*) FILTER (WHERE pq.status='published' AND pq.id::text IN
                (SELECT question_id FROM public.practice_attempts WHERE user_id=_uid AND solved=true)) AS solved_q
            FROM public.practice_questions pq GROUP BY pq.unit
          ) x WHERE total_q > 0 AND solved_q = total_q
        ); val := m.distinct_units;
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
END; $$;

CREATE OR REPLACE FUNCTION public.get_badge_progress(_user_id uuid DEFAULT NULL)
RETURNS TABLE(
  badge_key text, badge_name text, description text, icon text,
  category text, tier text, rarity text, is_secret boolean,
  target_value int, motivational_message text, unlock_hint text, sort_order int,
  current_value int, progress_pct int, earned boolean, earned_at timestamptz
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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
      WHEN 'unit_conqueror'    THEN v := CASE WHEN EXISTS(
          SELECT 1 FROM (
            SELECT pq.unit,
              COUNT(*) FILTER (WHERE pq.status='published') AS total_q,
              COUNT(*) FILTER (WHERE pq.status='published' AND pq.id::text IN
                (SELECT question_id FROM public.practice_attempts WHERE user_id=_uid AND solved=true)) AS solved_q
            FROM public.practice_questions pq GROUP BY pq.unit
          ) x WHERE total_q > 0 AND solved_q = total_q) THEN 1 ELSE 0 END;
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
      WHEN 'all_rounder'       THEN v := CASE WHEN m.all_rounder THEN 3 ELSE (CASE WHEN m.practice_solved>0 THEN 1 ELSE 0 END + CASE WHEN m.mock_count>0 THEN 1 ELSE 0 END) END;
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
END; $$;

GRANT EXECUTE ON FUNCTION public.get_badge_progress(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_next_badge_targets(_limit int DEFAULT 3)
RETURNS TABLE(
  badge_key text, badge_name text, icon text, category text, tier text,
  target_value int, current_value int, progress_pct int, unlock_hint text, motivational_message text
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT badge_key, badge_name, icon, category, tier, target_value, current_value,
         progress_pct, unlock_hint, motivational_message
  FROM public.get_badge_progress(auth.uid())
  WHERE NOT earned AND NOT is_secret AND COALESCE(target_value,0) > 0
    AND current_value > 0
  ORDER BY progress_pct DESC, target_value ASC
  LIMIT GREATEST(_limit, 1);
$$;

GRANT EXECUTE ON FUNCTION public.get_next_badge_targets(int) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_badge_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _most jsonb; _rare jsonb; _recent jsonb; _total_students int;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COUNT(*) INTO _total_students FROM auth.users;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO _most FROM (
    SELECT b.badge_key, b.badge_name, b.icon, b.tier, b.category,
           COUNT(sb.id)::int AS earned_count
    FROM public.badges b
    LEFT JOIN public.student_badges sb ON sb.badge_id = b.id
    GROUP BY b.id ORDER BY earned_count DESC NULLS LAST LIMIT 8
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO _rare FROM (
    SELECT b.badge_key, b.badge_name, b.icon, b.tier, b.category,
           COUNT(sb.id)::int AS earned_count
    FROM public.badges b
    LEFT JOIN public.student_badges sb ON sb.badge_id = b.id
    GROUP BY b.id ORDER BY earned_count ASC LIMIT 8
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO _recent FROM (
    SELECT b.badge_key, b.badge_name, b.icon, b.tier, sb.earned_at,
           COALESCE(p.display_name, 'Student') AS student_name
    FROM public.student_badges sb
    JOIN public.badges b ON b.id = sb.badge_id
    LEFT JOIN public.profiles p ON p.id = sb.student_id
    ORDER BY sb.earned_at DESC LIMIT 12
  ) t;

  RETURN jsonb_build_object(
    'total_students', _total_students,
    'most_earned', _most,
    'rarest', _rare,
    'recent', _recent
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.admin_badge_overview() TO authenticated, service_role;

-- Backfill
DO $$
DECLARE
  u record; m record; b record; hit boolean; val int;
BEGIN
  FOR u IN SELECT id FROM auth.users LOOP
    SELECT * INTO m FROM public.compute_badge_metrics(u.id);
    FOR b IN SELECT * FROM public.badges LOOP
      hit := false; val := NULL;
      CASE b.badge_key
        WHEN 'first_step'        THEN hit := m.first_activity  >= 1; val := m.first_activity;
        WHEN 'hello_python'      THEN hit := m.first_code_run  >= 1; val := m.first_code_run;
        WHEN 'first_solution'    THEN hit := m.practice_solved >= 1; val := m.practice_solved;
        WHEN 'homework_starter'  THEN hit := EXISTS(SELECT 1 FROM public.homework_submissions WHERE student_id=u.id AND status IN ('submitted','late','checked','returned')); val := 1;
        WHEN 'mock_explorer','mock_starter' THEN hit := m.mock_count >= 1; val := m.mock_count;
        WHEN 'spark'             THEN hit := m.longest_streak >= 3;  val := m.longest_streak;
        WHEN 'flame_keeper'      THEN hit := m.longest_streak >= 7;  val := m.longest_streak;
        WHEN 'momentum'          THEN hit := m.longest_streak >= 14; val := m.longest_streak;
        WHEN 'python_warrior'    THEN hit := m.longest_streak >= 30; val := m.longest_streak;
        WHEN 'unstoppable'       THEN hit := m.longest_streak >= 60; val := m.longest_streak;
        WHEN 'century_coder'     THEN hit := m.longest_streak >= 100;val := m.longest_streak;
        WHEN 'practice_rookie'   THEN hit := m.practice_solved >= 5;  val := m.practice_solved;
        WHEN 'practice_explorer' THEN hit := m.practice_solved >= 15; val := m.practice_solved;
        WHEN 'practice_pro'      THEN hit := m.practice_solved >= 30; val := m.practice_solved;
        WHEN 'practice_champion' THEN hit := m.practice_solved >= 60; val := m.practice_solved;
        WHEN 'practice_legend'   THEN hit := m.practice_solved >= 100;val := m.practice_solved;
        WHEN 'python_explorer'   THEN hit := m.distinct_units  >= 5;  val := m.distinct_units;
        WHEN 'clean_sweep'       THEN hit := m.clean_sweep_count >= 1;val := m.clean_sweep_count;
        WHEN 'test_tamer'        THEN hit := m.tests_passed >= 50;    val := m.tests_passed;
        WHEN 'test_master'       THEN hit := m.tests_passed >= 250;   val := m.tests_passed;
        WHEN 'bug_hunter'        THEN hit := m.bug_hunter_count >= 1; val := m.bug_hunter_count;
        WHEN 'debug_detective'   THEN hit := m.bug_hunter_count >= 10;val := m.bug_hunter_count;
        WHEN 'never_give_up'     THEN hit := m.never_give_up;         val := CASE WHEN m.never_give_up THEN 1 ELSE 0 END;
        WHEN 'comeback_coder'    THEN hit := m.comeback;              val := CASE WHEN m.comeback THEN 1 ELSE 0 END;
        WHEN 'growth_mindset'    THEN hit := m.mock_improve_15 >= 15; val := m.mock_improve_15;
        WHEN 'personal_best'     THEN hit := m.mock_personal_best;    val := CASE WHEN m.mock_personal_best THEN 1 ELSE 0 END;
        WHEN 'on_time'           THEN hit := m.homework_on_time >= 1; val := m.homework_on_time;
        WHEN 'homework_hero'     THEN hit := m.homework_on_time >= 5; val := m.homework_on_time;
        WHEN 'deadline_defender' THEN hit := m.homework_on_time >= 15;val := m.homework_on_time;
        WHEN 'homework_master'   THEN hit := m.homework_on_time >= 30;val := m.homework_on_time;
        WHEN 'perfect_submission'THEN hit := m.homework_perfect >= 1; val := m.homework_perfect;
        WHEN 'complete_thinker'  THEN hit := m.homework_complete >= 1;val := m.homework_complete;
        WHEN 'focused_learner'   THEN hit := m.mock_count >= 5;       val := m.mock_count;
        WHEN 'exam_ready'        THEN hit := m.mock_count >= 10;      val := m.mock_count;
        WHEN 'mock_marathon'     THEN hit := m.mock_count >= 25;      val := m.mock_count;
        WHEN 'accuracy_ace'      THEN hit := m.mock_best >= 80;       val := m.mock_best;
        WHEN 'python_scholar'    THEN hit := m.mock_best >= 90;       val := m.mock_best;
        WHEN 'perfect_score'     THEN hit := m.mock_best >= 100;      val := m.mock_best;
        WHEN 'rising_star'       THEN hit := m.mock_rising >= 3;      val := m.mock_rising;
        WHEN 'challenge_accepted'THEN hit := m.hard_solved >= 1;      val := m.hard_solved;
        WHEN 'difficulty_climber'THEN hit := m.diff_mix >= 3;         val := m.diff_mix;
        WHEN 'all_rounder'       THEN hit := m.all_rounder;           val := CASE WHEN m.all_rounder THEN 3 ELSE 0 END;
        WHEN 'early_finisher'    THEN hit := m.homework_early >= 1;   val := m.homework_early;
        WHEN 'unit_conqueror'    THEN hit := EXISTS(
            SELECT 1 FROM (
              SELECT pq.unit,
                COUNT(*) FILTER (WHERE pq.status='published') AS total_q,
                COUNT(*) FILTER (WHERE pq.status='published' AND pq.id::text IN
                  (SELECT question_id FROM public.practice_attempts WHERE user_id=u.id AND solved=true)) AS solved_q
              FROM public.practice_questions pq GROUP BY pq.unit
            ) x WHERE total_q > 0 AND solved_q = total_q); val := 1;
        ELSE hit := false;
      END CASE;
      IF hit THEN
        INSERT INTO public.student_badges (student_id, badge_id, source_type, metric_value, trigger_activity)
        VALUES (u.id, b.id, 'backfill', val, 'backfill')
        ON CONFLICT (student_id, badge_id) DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;
END $$;

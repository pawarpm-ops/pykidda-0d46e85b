
-- Badges catalog
CREATE TABLE public.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_key TEXT NOT NULL UNIQUE,
  badge_name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  threshold INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.badges TO authenticated, anon;
GRANT ALL ON public.badges TO service_role;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "badges readable by all" ON public.badges FOR SELECT USING (true);

-- Student badges
CREATE TABLE public.student_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_type TEXT,
  source_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, badge_id)
);
GRANT SELECT ON public.student_badges TO authenticated;
GRANT ALL ON public.student_badges TO service_role;
ALTER TABLE public.student_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "students read own badges" ON public.student_badges
  FOR SELECT TO authenticated USING (auth.uid() = student_id);
CREATE POLICY "admins read all badges" ON public.student_badges
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX idx_student_badges_student ON public.student_badges(student_id);
CREATE INDEX idx_student_badges_earned ON public.student_badges(earned_at DESC);

-- Seed catalog
INSERT INTO public.badges (badge_key, badge_name, description, icon, rule_type, threshold, sort_order) VALUES
  ('first_homework', 'First Homework Submitted', 'Submitted your first homework assignment', 'BookOpenCheck', 'first_homework', 1, 10),
  ('streak_7', '7-Day Streak', 'Kept a learning streak going for 7 days in a row', 'Flame', 'streak', 7, 20),
  ('python_beginner', 'Python Beginner', 'Solved your first 5 Python practice questions', 'Sprout', 'practice_solved', 5, 30),
  ('top_scorer', 'Top Scorer', 'Scored 90% or higher on a mock test', 'Trophy', 'mock_score', 90, 40),
  ('fast_solver', 'Fast Solver', 'Passed all test cases on a coding question on the first try', 'Zap', 'fast_solve', 1, 50),
  ('consistent_learner', 'Consistent Learner', 'Learned actively on 10 different days', 'CalendarCheck', 'active_days', 10, 60);

-- Award engine (SECURITY DEFINER — only awards based on real DB state)
CREATE OR REPLACE FUNCTION public.evaluate_and_award_badges(_event_type TEXT DEFAULT NULL)
RETURNS TABLE(badge_key TEXT, badge_name TEXT, description TEXT, icon TEXT, earned_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _b RECORD;
  _hw_count INT;
  _streak INT;
  _solved INT;
  _mock_best INT;
  _fast_hit INT;
  _active_days INT;
  _should BOOLEAN;
BEGIN
  IF _uid IS NULL THEN
    RETURN;
  END IF;

  -- Pre-compute stats once
  SELECT COUNT(*) INTO _hw_count FROM public.homework_submissions
    WHERE student_id = _uid AND status IN ('submitted','late','checked','returned');
  SELECT COALESCE(MAX(longest_streak),0) INTO _streak FROM public.student_streaks WHERE user_id = _uid;
  SELECT COUNT(DISTINCT question_id) INTO _solved FROM public.practice_attempts WHERE user_id = _uid AND solved = true;
  SELECT COALESCE(MAX(percentage),0) INTO _mock_best FROM public.mock_results WHERE user_id = _uid;
  SELECT COUNT(*) INTO _fast_hit FROM public.practice_attempts
    WHERE user_id = _uid AND solved = true AND passed IS NOT NULL AND total IS NOT NULL AND passed = total AND total > 0;
  SELECT COUNT(DISTINCT activity_date) INTO _active_days FROM public.streak_activity_logs WHERE user_id = _uid;

  FOR _b IN SELECT * FROM public.badges LOOP
    _should := false;
    IF _b.rule_type = 'first_homework' AND _hw_count >= 1 THEN _should := true;
    ELSIF _b.rule_type = 'streak' AND _streak >= COALESCE(_b.threshold, 7) THEN _should := true;
    ELSIF _b.rule_type = 'practice_solved' AND _solved >= COALESCE(_b.threshold, 5) THEN _should := true;
    ELSIF _b.rule_type = 'mock_score' AND _mock_best >= COALESCE(_b.threshold, 90) THEN _should := true;
    ELSIF _b.rule_type = 'fast_solve' AND _fast_hit >= COALESCE(_b.threshold, 1) THEN _should := true;
    ELSIF _b.rule_type = 'active_days' AND _active_days >= COALESCE(_b.threshold, 10) THEN _should := true;
    END IF;

    IF _should THEN
      INSERT INTO public.student_badges (student_id, badge_id, source_type)
      VALUES (_uid, _b.id, _event_type)
      ON CONFLICT (student_id, badge_id) DO NOTHING;

      -- Only return the row if this insert actually created it just now
      IF FOUND THEN
        RETURN QUERY SELECT _b.badge_key, _b.badge_name, _b.description, _b.icon, now();
      END IF;
    END IF;
  END LOOP;

  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.evaluate_and_award_badges(TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.evaluate_and_award_badges(TEXT) TO authenticated;

-- List badges for a student (all catalog + earned status)
CREATE OR REPLACE FUNCTION public.list_badges_for_student(_student_id UUID)
RETURNS TABLE(
  badge_key TEXT, badge_name TEXT, description TEXT, icon TEXT,
  rule_type TEXT, threshold INTEGER, sort_order INTEGER,
  earned BOOLEAN, earned_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.badge_key, b.badge_name, b.description, b.icon,
         b.rule_type, b.threshold, b.sort_order,
         (sb.id IS NOT NULL) AS earned,
         sb.earned_at
  FROM public.badges b
  LEFT JOIN public.student_badges sb
    ON sb.badge_id = b.id AND sb.student_id = _student_id
  WHERE
    _student_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  ORDER BY b.sort_order;
$$;

GRANT EXECUTE ON FUNCTION public.list_badges_for_student(UUID) TO authenticated;

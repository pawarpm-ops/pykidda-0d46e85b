-- 1) Sequence + column
CREATE SEQUENCE IF NOT EXISTS public.pyk_student_id_seq START WITH 1 INCREMENT BY 1;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS student_unique_id TEXT UNIQUE;

-- 2) Generator function
CREATE OR REPLACE FUNCTION public.generate_student_unique_id()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  candidate TEXT;
BEGIN
  LOOP
    candidate := 'PYK-' || lpad(nextval('public.pyk_student_id_seq')::text, 4, '0');
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE student_unique_id = candidate) THEN
      RETURN candidate;
    END IF;
  END LOOP;
END;
$$;

-- 3) Trigger to auto-set on insert
CREATE OR REPLACE FUNCTION public.set_student_unique_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.student_unique_id IS NULL THEN
    NEW.student_unique_id := public.generate_student_unique_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_student_unique_id ON public.profiles;
CREATE TRIGGER trg_set_student_unique_id
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_student_unique_id();

-- 4) Backfill existing rows (oldest first so early adopters get low numbers)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE student_unique_id IS NULL ORDER BY created_at ASC LOOP
    UPDATE public.profiles SET student_unique_id = public.generate_student_unique_id() WHERE id = r.id;
  END LOOP;
END $$;

-- 5) Directory lookup: safe public fields for a set of user ids
CREATE OR REPLACE FUNCTION public.get_student_directory(_ids UUID[])
RETURNS TABLE (
  id UUID,
  display_name TEXT,
  avatar_url TEXT,
  student_unique_id TEXT,
  public_profile_id TEXT,
  qr_enabled BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.display_name, p.avatar_url, p.student_unique_id, p.public_profile_id, p.qr_enabled
  FROM public.profiles p
  WHERE p.id = ANY(_ids)
$$;

REVOKE ALL ON FUNCTION public.get_student_directory(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_student_directory(UUID[]) TO authenticated;

-- 6) Update public profile RPC to include the Student ID
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
  practice_solved int;
  units_completed int[];
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

  SELECT COUNT(DISTINCT question_id)::int INTO practice_solved
  FROM public.practice_attempts
  WHERE user_id = p.id AND solved = true;

  SELECT COALESCE(array_agg(DISTINCT unit ORDER BY unit), ARRAY[]::int[])
    INTO units_completed
  FROM public.practice_attempts
  WHERE user_id = p.id AND solved = true;

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
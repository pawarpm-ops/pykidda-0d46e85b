
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS public_profile_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS qr_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS public_profile_settings jsonb NOT NULL DEFAULT jsonb_build_object(
    'showAvatar', true,
    'showClass', false,
    'showStreak', true,
    'showBadges', true,
    'showCertificates', false,
    'showLeaderboardRank', true,
    'showCompletedUnits', true
  ),
  ADD COLUMN IF NOT EXISTS qr_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS qr_updated_at timestamptz;

-- Short URL-safe id built from a UUID (no pgcrypto dependency).
CREATE OR REPLACE FUNCTION public.generate_public_profile_id()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  candidate text;
BEGIN
  FOR attempt IN 1..5 LOOP
    -- 12 lowercase hex chars from a fresh uuid; more than enough entropy.
    candidate := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE public_profile_id = candidate) THEN
      RETURN candidate;
    END IF;
  END LOOP;
  RAISE EXCEPTION 'Could not generate a unique public profile id';
END;
$$;

UPDATE public.profiles
SET public_profile_id = public.generate_public_profile_id(),
    qr_created_at = COALESCE(qr_created_at, now()),
    qr_updated_at = COALESCE(qr_updated_at, now())
WHERE public_profile_id IS NULL;

CREATE OR REPLACE FUNCTION public.set_public_profile_defaults()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.public_profile_id IS NULL THEN
    NEW.public_profile_id := public.generate_public_profile_id();
  END IF;
  IF NEW.qr_created_at IS NULL THEN
    NEW.qr_created_at := now();
  END IF;
  NEW.qr_updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_public_defaults ON public.profiles;
CREATE TRIGGER trg_profiles_public_defaults
BEFORE INSERT OR UPDATE OF public_profile_id, qr_enabled, public_profile_settings ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_public_profile_defaults();

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles"
ON public.profiles FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.get_public_student_profile(_public_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.get_public_student_profile(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_student_profile(text) TO anon, authenticated;


-- 1) LOCK DOWN STREAK TABLES: remove direct write access; force writes through record_streak_activity RPC.
REVOKE INSERT, UPDATE, DELETE ON public.student_streaks FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.streak_activity_logs FROM authenticated, anon;
GRANT SELECT ON public.student_streaks TO authenticated;
GRANT SELECT ON public.streak_activity_logs TO authenticated;

-- Drop any policies that granted direct write access
DROP POLICY IF EXISTS "Users insert own streak" ON public.student_streaks;
DROP POLICY IF EXISTS "Users update own streak" ON public.student_streaks;
DROP POLICY IF EXISTS "Users insert own streak log" ON public.streak_activity_logs;
DROP POLICY IF EXISTS "Users update own streak log" ON public.streak_activity_logs;
DROP POLICY IF EXISTS "Users delete own streak log" ON public.streak_activity_logs;

-- 2) LEADERBOARD_SCORES: nuke any lingering write policies
DROP POLICY IF EXISTS "Users can insert their own score" ON public.leaderboard_scores;
DROP POLICY IF EXISTS "Users can update their own score" ON public.leaderboard_scores;
DROP POLICY IF EXISTS "Users can delete their own score" ON public.leaderboard_scores;
REVOKE INSERT, UPDATE, DELETE ON public.leaderboard_scores FROM authenticated, anon;

-- 3) SECURITY DEFINER function exposure — restrict EXECUTE to only what's needed
REVOKE EXECUTE ON FUNCTION public.record_streak_activity(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_streak_activity(text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- 4) GRANT ADMIN ROLE to two new emails (immediately if user exists)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE lower(email) IN ('minakshee2000@gmail.com', 'vvjadhav@coe.sveri.ac.in')
ON CONFLICT (user_id, role) DO NOTHING;

-- 5) UPDATE new-user role trigger to auto-grant admin on future sign-ups for these emails
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    CASE
      WHEN lower(NEW.email) IN (
        'siddhustudyhard@gmail.com',
        'minakshee2000@gmail.com',
        'vvjadhav@coe.sveri.ac.in'
      ) THEN 'admin'::public.app_role
      ELSE 'student'::public.app_role
    END
  )
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;

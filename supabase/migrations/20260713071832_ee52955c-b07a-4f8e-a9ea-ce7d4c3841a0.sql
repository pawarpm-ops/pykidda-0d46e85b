-- Admin/Teacher Activity Audit Log

CREATE TABLE public.admin_activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID NOT NULL,
  actor_name TEXT,
  actor_email TEXT,
  actor_role TEXT,
  action_type TEXT NOT NULL,
  action_description TEXT NOT NULL,
  module_name TEXT NOT NULL,
  target_id TEXT,
  target_title TEXT,
  related_student_id UUID,
  old_value JSONB,
  new_value JSONB,
  metadata JSONB,
  status TEXT NOT NULL DEFAULT 'success',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_activity_logs TO authenticated;
GRANT ALL ON public.admin_activity_logs TO service_role;

ALTER TABLE public.admin_activity_logs ENABLE ROW LEVEL SECURITY;

-- Admin can read every log
CREATE POLICY "Admins can view all audit logs"
  ON public.admin_activity_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Non-admin authenticated users (e.g. teachers) can only see their own
CREATE POLICY "Actors can view their own audit logs"
  ON public.admin_activity_logs
  FOR SELECT
  TO authenticated
  USING (actor_id = auth.uid());

-- No INSERT/UPDATE/DELETE policies for authenticated: writes must go through
-- the SECURITY DEFINER RPC below (or service_role, which bypasses RLS).

CREATE INDEX admin_activity_logs_created_at_idx
  ON public.admin_activity_logs (created_at DESC);
CREATE INDEX admin_activity_logs_actor_created_idx
  ON public.admin_activity_logs (actor_id, created_at DESC);
CREATE INDEX admin_activity_logs_module_created_idx
  ON public.admin_activity_logs (module_name, created_at DESC);
CREATE INDEX admin_activity_logs_action_created_idx
  ON public.admin_activity_logs (action_type, created_at DESC);
CREATE INDEX admin_activity_logs_student_created_idx
  ON public.admin_activity_logs (related_student_id, created_at DESC)
  WHERE related_student_id IS NOT NULL;

-- Writer RPC — snapshots actor identity from profiles + user_roles.
CREATE OR REPLACE FUNCTION public.log_admin_activity(
  _action_type TEXT,
  _action_description TEXT,
  _module_name TEXT,
  _target_id TEXT DEFAULT NULL,
  _target_title TEXT DEFAULT NULL,
  _related_student_id UUID DEFAULT NULL,
  _old_value JSONB DEFAULT NULL,
  _new_value JSONB DEFAULT NULL,
  _metadata JSONB DEFAULT NULL,
  _status TEXT DEFAULT 'success'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _name TEXT;
  _email TEXT;
  _role TEXT;
  _new_id UUID;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT display_name INTO _name FROM public.profiles WHERE id = _uid;

  BEGIN
    SELECT email::text INTO _email FROM auth.users WHERE id = _uid;
  EXCEPTION WHEN OTHERS THEN
    _email := NULL;
  END;

  SELECT role::text INTO _role
  FROM public.user_roles
  WHERE user_id = _uid
  ORDER BY (role = 'admin') DESC
  LIMIT 1;

  INSERT INTO public.admin_activity_logs (
    actor_id, actor_name, actor_email, actor_role,
    action_type, action_description, module_name,
    target_id, target_title, related_student_id,
    old_value, new_value, metadata, status
  )
  VALUES (
    _uid, _name, _email, COALESCE(_role, 'unknown'),
    _action_type, _action_description, _module_name,
    _target_id, _target_title, _related_student_id,
    _old_value, _new_value, _metadata, COALESCE(_status, 'success')
  )
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_admin_activity(
  TEXT, TEXT, TEXT, TEXT, TEXT, UUID, JSONB, JSONB, JSONB, TEXT
) TO authenticated, service_role;
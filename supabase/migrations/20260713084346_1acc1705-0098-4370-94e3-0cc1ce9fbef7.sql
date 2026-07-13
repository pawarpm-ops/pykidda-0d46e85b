
-- has_any_role: true if user has any of the listed roles
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles public.app_role[])
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = ANY(_roles)
  )
$$;

-- is_super_admin convenience
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'
  )
$$;

-- assign_user_role: only super_admins can change roles.
-- action = 'grant' | 'revoke'
CREATE OR REPLACE FUNCTION public.assign_user_role(
  _target_user uuid,
  _role public.app_role,
  _action text DEFAULT 'grant'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor uuid := auth.uid();
BEGIN
  IF _actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_super_admin(_actor) THEN
    RAISE EXCEPTION 'You do not have permission to perform this action' USING ERRCODE = '42501';
  END IF;

  IF _target_user IS NULL THEN
    RAISE EXCEPTION 'Target user required';
  END IF;

  IF _action = 'grant' THEN
    INSERT INTO public.user_roles(user_id, role)
    VALUES (_target_user, _role)
    ON CONFLICT (user_id, role) DO NOTHING;

    PERFORM public.log_admin_activity(
      'role_granted',
      format('Granted role %s', _role::text),
      'role_management',
      _target_user::text,
      NULL,
      _target_user,
      NULL,
      jsonb_build_object('role', _role::text),
      NULL,
      'success'
    );
  ELSIF _action = 'revoke' THEN
    -- Never allow revoking the last super_admin
    IF _role = 'super_admin' THEN
      IF (SELECT COUNT(*) FROM public.user_roles WHERE role = 'super_admin') <= 1 THEN
        RAISE EXCEPTION 'Cannot revoke the last super_admin';
      END IF;
    END IF;

    DELETE FROM public.user_roles
    WHERE user_id = _target_user AND role = _role;

    PERFORM public.log_admin_activity(
      'role_revoked',
      format('Revoked role %s', _role::text),
      'role_management',
      _target_user::text,
      NULL,
      _target_user,
      jsonb_build_object('role', _role::text),
      NULL,
      NULL,
      'success'
    );
  ELSE
    RAISE EXCEPTION 'Invalid action: %', _action;
  END IF;
END;
$$;

-- Only authenticated users can even attempt to call it; the function itself
-- verifies super_admin. Anon must not be able to probe.
REVOKE ALL ON FUNCTION public.assign_user_role(uuid, public.app_role, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_user_role(uuid, public.app_role, text) TO authenticated;

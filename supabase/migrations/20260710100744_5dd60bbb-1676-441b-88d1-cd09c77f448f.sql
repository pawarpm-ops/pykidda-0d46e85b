-- Restrict announcements SELECT policy to authenticated only
DROP POLICY IF EXISTS "Users read relevant announcements" ON public.announcements;
CREATE POLICY "Users read relevant announcements"
ON public.announcements
FOR SELECT TO authenticated
USING (
  ((target_user_id IS NULL) OR (target_user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  AND (has_role(auth.uid(), 'admin'::app_role) OR (scheduled_at IS NULL) OR (scheduled_at <= now()))
);

-- Explicit deny of client writes on user_roles (only service_role or SECURITY DEFINER paths may write)
CREATE POLICY "No client insert on user_roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (false);

CREATE POLICY "No client update on user_roles"
ON public.user_roles FOR UPDATE TO authenticated
USING (false) WITH CHECK (false);

CREATE POLICY "No client delete on user_roles"
ON public.user_roles FOR DELETE TO authenticated
USING (false);
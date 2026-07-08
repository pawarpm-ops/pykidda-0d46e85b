
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;

DROP POLICY IF EXISTS "Users read relevant announcements" ON public.announcements;

CREATE POLICY "Users read relevant announcements"
ON public.announcements
FOR SELECT
USING (
  (
    (target_user_id IS NULL) OR (target_user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR scheduled_at IS NULL
    OR scheduled_at <= now()
  )
);

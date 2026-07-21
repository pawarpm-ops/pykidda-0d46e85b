
CREATE OR REPLACE FUNCTION public.admin_resend_announcement(_id uuid, _scheduled_at timestamptz DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _author uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_role(_uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT author_id INTO _author FROM public.announcements WHERE id = _id;
  IF _author IS NULL THEN
    RAISE EXCEPTION 'Announcement not found';
  END IF;
  IF _author <> _uid THEN
    RAISE EXCEPTION 'Only the original author can resend' USING ERRCODE = '42501';
  END IF;

  -- Clear all read/dismissed markers so every recipient sees it as unread again.
  DELETE FROM public.announcement_reads WHERE announcement_id = _id;

  -- Bump timestamps so it surfaces at the top and, if rescheduled, waits for the new time.
  UPDATE public.announcements
    SET created_at = now(),
        scheduled_at = _scheduled_at
    WHERE id = _id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_resend_announcement(uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_resend_announcement(uuid, timestamptz) TO authenticated;

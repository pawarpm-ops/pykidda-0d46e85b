
ALTER TABLE public.student_streaks
  ADD COLUMN IF NOT EXISTS last_freeze_grant_month DATE,
  ADD COLUMN IF NOT EXISTS last_freeze_used_at TIMESTAMPTZ;

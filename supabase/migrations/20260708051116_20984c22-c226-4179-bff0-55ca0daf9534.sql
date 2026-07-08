ALTER TABLE public.announcement_reads
  ADD COLUMN IF NOT EXISTS dismissed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_announcement_reads_user_dismissed
  ON public.announcement_reads (user_id, dismissed_at);
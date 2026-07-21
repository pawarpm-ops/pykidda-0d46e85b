-- Add teacher manual grading fields to ai_mock_attempts
ALTER TABLE public.ai_mock_attempts
  ADD COLUMN IF NOT EXISTS grading_status TEXT NOT NULL DEFAULT 'published'
    CHECK (grading_status IN ('pending_review','in_review','published')),
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS teacher_feedback TEXT,
  ADD COLUMN IF NOT EXISTS auto_marks_obtained NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_percentage INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS ai_mock_attempts_grading_status_idx
  ON public.ai_mock_attempts (test_id, grading_status);

-- Backfill: mirror current final scores into auto_* so historical rows have
-- something meaningful, and mark them as published (they already are).
UPDATE public.ai_mock_attempts
  SET auto_marks_obtained = marks_obtained,
      auto_percentage = percentage
  WHERE auto_marks_obtained = 0 AND auto_percentage = 0;

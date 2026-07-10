
ALTER TABLE public.ai_mock_tests
  ADD COLUMN IF NOT EXISTS test_kind text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS scheduled_start_at timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_end_at timestamptz,
  ADD COLUMN IF NOT EXISTS schedule_instructions text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS results_visibility text NOT NULL DEFAULT 'immediate';

ALTER TABLE public.ai_mock_tests
  DROP CONSTRAINT IF EXISTS ai_mock_tests_kind_chk;
ALTER TABLE public.ai_mock_tests
  ADD CONSTRAINT ai_mock_tests_kind_chk CHECK (test_kind IN ('normal','scheduled'));

ALTER TABLE public.ai_mock_tests
  DROP CONSTRAINT IF EXISTS ai_mock_tests_results_visibility_chk;
ALTER TABLE public.ai_mock_tests
  ADD CONSTRAINT ai_mock_tests_results_visibility_chk CHECK (results_visibility IN ('immediate','after_end'));

-- Schedule validity (only checked when both provided)
ALTER TABLE public.ai_mock_tests
  DROP CONSTRAINT IF EXISTS ai_mock_tests_schedule_window_chk;
ALTER TABLE public.ai_mock_tests
  ADD CONSTRAINT ai_mock_tests_schedule_window_chk
  CHECK (
    scheduled_start_at IS NULL
    OR scheduled_end_at IS NULL
    OR scheduled_end_at > scheduled_start_at
  );

-- Deep-link URL for announcement View buttons
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS action_url text;

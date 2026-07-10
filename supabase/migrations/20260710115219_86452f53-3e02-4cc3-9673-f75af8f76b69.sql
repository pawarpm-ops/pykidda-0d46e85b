
-- Extend assignments (Homework) with AI + self-solve support
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS question_source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS refined_by_ai boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS submission_mode text NOT NULL DEFAULT 'submit',
  ADD COLUMN IF NOT EXISTS input_format text,
  ADD COLUMN IF NOT EXISTS output_format text,
  ADD COLUMN IF NOT EXISTS constraints text,
  ADD COLUMN IF NOT EXISTS hints text,
  ADD COLUMN IF NOT EXISTS instructions text,
  ADD COLUMN IF NOT EXISTS test_cases jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_prompt_summary text;

-- Guard values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'assignments_question_source_chk'
  ) THEN
    ALTER TABLE public.assignments
      ADD CONSTRAINT assignments_question_source_chk
      CHECK (question_source IN ('manual','ai_generated','migrated_practice'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'assignments_submission_mode_chk'
  ) THEN
    ALTER TABLE public.assignments
      ADD CONSTRAINT assignments_submission_mode_chk
      CHECK (submission_mode IN ('submit','self_solve'));
  END IF;
END $$;

-- Allow self_solve homework to have no due_at
ALTER TABLE public.assignments ALTER COLUMN due_at DROP NOT NULL;

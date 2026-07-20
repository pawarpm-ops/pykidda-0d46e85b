ALTER TABLE public.pyko_conversations DROP CONSTRAINT IF EXISTS pyko_conversations_mode_check;
ALTER TABLE public.pyko_conversations ADD CONSTRAINT pyko_conversations_mode_check
  CHECK (mode = ANY (ARRAY['guide','tutor','corrector','coach','teacher','allrounder']));

UPDATE public.pyko_feature_flags SET enabled = true, updated_at = now()
  WHERE key IN ('pyko_mode_tutor','pyko_mode_corrector','pyko_mode_coach');
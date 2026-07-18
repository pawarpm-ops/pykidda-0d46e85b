INSERT INTO public.pyko_feature_flags (key, enabled, description)
VALUES
  ('pyko_mode_allrounder', true, 'All-Rounder Pyko mode (guide + tutor + corrector + coach router)'),
  ('pyko_mode_guide', true, 'Guide Pyko mode'),
  ('pyko_mode_tutor', true, 'AI Teacher (tutor) Pyko mode'),
  ('pyko_mode_corrector', true, 'Corrector Pyko sub-mode'),
  ('pyko_mode_coach', true, 'Coach Pyko sub-mode')
ON CONFLICT (key) DO NOTHING;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pyko_conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pyko_messages TO authenticated;
GRANT SELECT ON public.pyko_feature_flags TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE ON public.pyko_assessment_sessions TO authenticated;
GRANT SELECT ON public.pyko_budget_counters TO authenticated;
GRANT ALL ON public.pyko_conversations, public.pyko_messages, public.pyko_feature_flags, public.pyko_assessment_sessions, public.pyko_budget_counters, public.pyko_telemetry TO service_role;
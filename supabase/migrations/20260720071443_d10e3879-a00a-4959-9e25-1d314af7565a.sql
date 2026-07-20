-- Lock down Pyko server-only RPCs: only service_role (server functions) may call.
REVOKE ALL ON FUNCTION public.pyko_touch_budget(uuid, date, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pyko_touch_budget(uuid, date, integer, integer) TO service_role;

REVOKE ALL ON FUNCTION public.pyko_start_assessment(text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pyko_start_assessment(text, text, integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.pyko_end_assessment(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pyko_end_assessment(text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.pyko_has_active_assessment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pyko_has_active_assessment(uuid) TO authenticated, service_role;
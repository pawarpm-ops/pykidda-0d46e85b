
REVOKE SELECT (expected_output, test_cases) ON public.assignments FROM PUBLIC;
REVOKE SELECT (expected_output, test_cases) ON public.assignments FROM anon;
REVOKE SELECT (expected_output, test_cases) ON public.assignments FROM authenticated;
GRANT SELECT ON public.assignments TO service_role;

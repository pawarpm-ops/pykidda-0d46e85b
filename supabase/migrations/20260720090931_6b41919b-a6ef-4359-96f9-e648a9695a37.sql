-- Phase 1 Pyko lockdown: least-privilege grants on pyko_* tables.
-- RLS already scopes SELECT/INSERT/UPDATE/DELETE per-user, but the underlying
-- Data API GRANTs were left wide open to `anon` from earlier scaffolding. This
-- migration revokes anon entirely (Pyko is an authenticated feature) and
-- tightens `authenticated` down to only what each table's RLS actually allows.
-- Writes on budget/telemetry/assessment continue via SECURITY DEFINER RPCs
-- and supabaseAdmin; nothing in the app relies on direct anon or wide
-- authenticated writes on these tables.

-- 1. Remove anon entirely from every pyko_* table.
REVOKE ALL ON public.pyko_assessment_sessions FROM anon;
REVOKE ALL ON public.pyko_budget_counters     FROM anon;
REVOKE ALL ON public.pyko_conversations       FROM anon;
REVOKE ALL ON public.pyko_feature_flags       FROM anon;
REVOKE ALL ON public.pyko_messages            FROM anon;
REVOKE ALL ON public.pyko_telemetry           FROM anon;

-- 2. Assessment sessions: RLS is SELECT-own only. Writes go through
--    pyko_start_assessment / pyko_end_assessment (SECURITY DEFINER).
REVOKE ALL ON public.pyko_assessment_sessions FROM authenticated;
GRANT SELECT ON public.pyko_assessment_sessions TO authenticated;
GRANT ALL    ON public.pyko_assessment_sessions TO service_role;

-- 3. Budget counters: RLS is SELECT-own + admin-read. Writes are done
--    exclusively by pyko_touch_budget (already SECURITY DEFINER, service_role).
REVOKE ALL ON public.pyko_budget_counters FROM authenticated;
GRANT SELECT ON public.pyko_budget_counters TO authenticated;
GRANT ALL    ON public.pyko_budget_counters TO service_role;

-- 4. Feature flags: readable by every authenticated user (matches RLS);
--    admin-only writes are already gated by RLS.
REVOKE ALL ON public.pyko_feature_flags FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pyko_feature_flags TO authenticated;
GRANT ALL ON public.pyko_feature_flags TO service_role;

-- 5. Conversations & messages: owner-all, admin-read. Keep authenticated
--    CRUD so students can rename/delete their own conversations later.
REVOKE ALL ON public.pyko_conversations FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pyko_conversations TO authenticated;
GRANT ALL ON public.pyko_conversations TO service_role;

REVOKE ALL ON public.pyko_messages FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pyko_messages TO authenticated;
GRANT ALL ON public.pyko_messages TO service_role;

-- 6. Telemetry: admin-read via RLS. Writes go through supabaseAdmin only —
--    no user code should insert here. Grant admin the read path, service_role
--    everything, and DO NOT grant authenticated any write privilege.
REVOKE ALL ON public.pyko_telemetry FROM authenticated;
GRANT SELECT ON public.pyko_telemetry TO authenticated;
GRANT ALL    ON public.pyko_telemetry TO service_role;

-- 7. Belt-and-suspenders: ensure no PUBLIC role grant leaked through.
REVOKE ALL ON public.pyko_assessment_sessions FROM PUBLIC;
REVOKE ALL ON public.pyko_budget_counters     FROM PUBLIC;
REVOKE ALL ON public.pyko_conversations       FROM PUBLIC;
REVOKE ALL ON public.pyko_feature_flags       FROM PUBLIC;
REVOKE ALL ON public.pyko_messages            FROM PUBLIC;
REVOKE ALL ON public.pyko_telemetry           FROM PUBLIC;
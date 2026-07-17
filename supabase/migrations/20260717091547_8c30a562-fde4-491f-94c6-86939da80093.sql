
-- =========================
-- Pyko AI: Foundation tables
-- =========================

-- Conversations
CREATE TABLE public.pyko_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('guide','tutor','corrector','coach','teacher')),
  title TEXT,
  page_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX pyko_conversations_user_idx ON public.pyko_conversations(user_id, updated_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pyko_conversations TO authenticated;
GRANT ALL ON public.pyko_conversations TO service_role;
ALTER TABLE public.pyko_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pyko_conv_owner_all" ON public.pyko_conversations
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pyko_conv_admin_read" ON public.pyko_conversations
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Messages
CREATE TABLE public.pyko_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.pyko_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system','tool')),
  content TEXT NOT NULL,
  mode TEXT NOT NULL,
  prompt_version TEXT,
  model TEXT,
  tool_calls JSONB,
  safe_source_ids JSONB,
  latency_ms INTEGER,
  feedback TEXT CHECK (feedback IN ('up','down','flag') OR feedback IS NULL),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX pyko_messages_conv_idx ON public.pyko_messages(conversation_id, created_at);
CREATE INDEX pyko_messages_user_idx ON public.pyko_messages(user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pyko_messages TO authenticated;
GRANT ALL ON public.pyko_messages TO service_role;
ALTER TABLE public.pyko_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pyko_msg_owner_all" ON public.pyko_messages
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pyko_msg_admin_read" ON public.pyko_messages
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Telemetry (server-writes only)
CREATE TABLE public.pyko_telemetry (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  trace_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  prompt_version TEXT,
  provider TEXT,
  model TEXT,
  tool_names TEXT[],
  latency_ms INTEGER,
  response_status TEXT,
  safe_source_ids JSONB,
  feedback_status TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX pyko_telemetry_user_idx ON public.pyko_telemetry(user_id, created_at DESC);
CREATE INDEX pyko_telemetry_trace_idx ON public.pyko_telemetry(trace_id);

GRANT SELECT ON public.pyko_telemetry TO authenticated;
GRANT ALL ON public.pyko_telemetry TO service_role;
ALTER TABLE public.pyko_telemetry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pyko_tele_admin_read" ON public.pyko_telemetry
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Budget counters (server-writes only)
CREATE TABLE public.pyko_budget_counters (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  token_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);
GRANT SELECT ON public.pyko_budget_counters TO authenticated;
GRANT ALL ON public.pyko_budget_counters TO service_role;
ALTER TABLE public.pyko_budget_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pyko_budget_owner_read" ON public.pyko_budget_counters
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "pyko_budget_admin_read" ON public.pyko_budget_counters
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Feature flags
CREATE TABLE public.pyko_feature_flags (
  key TEXT NOT NULL PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
GRANT SELECT ON public.pyko_feature_flags TO authenticated;
GRANT ALL ON public.pyko_feature_flags TO service_role;
ALTER TABLE public.pyko_feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pyko_flags_read_all" ON public.pyko_feature_flags
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "pyko_flags_admin_write" ON public.pyko_feature_flags
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- updated_at triggers (reuse existing helper)
CREATE TRIGGER pyko_conv_updated_at
  BEFORE UPDATE ON public.pyko_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER pyko_flags_updated_at
  BEFORE UPDATE ON public.pyko_feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default flags (all OFF)
INSERT INTO public.pyko_feature_flags (key, enabled, description) VALUES
  ('pyko_ai_enabled', false, 'Master switch for the Pyko AI assistant. Off by default.'),
  ('pyko_mode_guide', false, 'Website Guide mode'),
  ('pyko_mode_tutor', false, 'Python Tutor mode'),
  ('pyko_mode_corrector', false, 'AI Code Corrector mode'),
  ('pyko_mode_coach', false, 'Progress Coach mode'),
  ('pyko_mode_teacher', false, 'Teacher Copilot mode')
ON CONFLICT (key) DO NOTHING;

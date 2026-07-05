
CREATE TABLE public.ai_mock_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  syllabus_snippet TEXT NOT NULL DEFAULT '',
  duration_sec INTEGER NOT NULL DEFAULT 1800,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  total_marks INTEGER NOT NULL DEFAULT 0,
  question_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);
GRANT SELECT ON public.ai_mock_tests TO authenticated;
GRANT ALL ON public.ai_mock_tests TO service_role;
ALTER TABLE public.ai_mock_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read all tests" ON public.ai_mock_tests
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "students read published tests" ON public.ai_mock_tests
  FOR SELECT TO authenticated USING (status = 'published');

CREATE TRIGGER ai_mock_tests_updated_at BEFORE UPDATE ON public.ai_mock_tests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ai_mock_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL REFERENCES public.ai_mock_tests(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL CHECK (type IN ('mcq','tf','fill','short','code')),
  prompt TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_answer TEXT NOT NULL DEFAULT '',
  starter_code TEXT NOT NULL DEFAULT '',
  code_tests JSONB NOT NULL DEFAULT '[]'::jsonb,
  marks INTEGER NOT NULL DEFAULT 1,
  explanation TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.ai_mock_questions TO service_role;
ALTER TABLE public.ai_mock_questions ENABLE ROW LEVEL SECURITY;
-- No SELECT/INSERT/UPDATE/DELETE grants for authenticated: all access via server functions.

CREATE INDEX ai_mock_questions_test_idx ON public.ai_mock_questions(test_id, order_index);

CREATE TABLE public.ai_mock_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  test_id UUID NOT NULL REFERENCES public.ai_mock_tests(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  submission_type TEXT NOT NULL DEFAULT 'normal',
  violation_reason TEXT,
  marks_obtained NUMERIC NOT NULL DEFAULT 0,
  total_marks NUMERIC NOT NULL DEFAULT 0,
  percentage INTEGER NOT NULL DEFAULT 0,
  grade TEXT NOT NULL DEFAULT 'F',
  time_taken_sec INTEGER NOT NULL DEFAULT 0,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb
);
GRANT SELECT ON public.ai_mock_attempts TO authenticated;
GRANT ALL ON public.ai_mock_attempts TO service_role;
ALTER TABLE public.ai_mock_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own attempts read" ON public.ai_mock_attempts
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

CREATE INDEX ai_mock_attempts_user_idx ON public.ai_mock_attempts(user_id, submitted_at DESC);
CREATE INDEX ai_mock_attempts_test_idx ON public.ai_mock_attempts(test_id, submitted_at DESC);

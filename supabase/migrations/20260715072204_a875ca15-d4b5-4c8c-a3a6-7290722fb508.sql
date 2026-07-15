
CREATE TABLE public.practice_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  unit INT NOT NULL,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  starter_code TEXT NOT NULL DEFAULT '',
  tests JSONB NOT NULL DEFAULT '[]'::jsonb,
  hint TEXT,
  solution TEXT,
  marks INT NOT NULL DEFAULT 4,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  difficulty TEXT CHECK (difficulty IN ('easy','medium','hard')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.practice_questions TO authenticated;
GRANT ALL ON public.practice_questions TO service_role;

ALTER TABLE public.practice_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students read published practice questions"
  ON public.practice_questions FOR SELECT TO authenticated
  USING (status = 'published' OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins insert practice questions"
  ON public.practice_questions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins update practice questions"
  ON public.practice_questions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins delete practice questions"
  ON public.practice_questions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER practice_questions_set_updated_at
  BEFORE UPDATE ON public.practice_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX practice_questions_unit_status_idx ON public.practice_questions (unit, status);

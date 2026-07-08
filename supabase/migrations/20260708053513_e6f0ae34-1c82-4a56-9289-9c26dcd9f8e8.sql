
-- assignments
CREATE TABLE public.assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  unit INTEGER,
  topic TEXT,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  assignment_type TEXT NOT NULL DEFAULT 'coding' CHECK (assignment_type IN ('coding','written','mixed')),
  total_marks INTEGER NOT NULL DEFAULT 10 CHECK (total_marks >= 0 AND total_marks <= 1000),
  due_at TIMESTAMPTZ NOT NULL,
  allow_late_submission BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','closed')),
  sample_input TEXT,
  sample_output TEXT,
  expected_output TEXT,
  starter_code TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignments TO authenticated;
GRANT ALL ON public.assignments TO service_role;

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view published assignments"
  ON public.assignments FOR SELECT TO authenticated
  USING (status IN ('published','closed') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage assignments insert"
  ON public.assignments FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND created_by = auth.uid());

CREATE POLICY "Admins manage assignments update"
  ON public.assignments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage assignments delete"
  ON public.assignments FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_assignments_updated_at
  BEFORE UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX assignments_status_due_idx ON public.assignments (status, due_at DESC);

-- assignment_submissions
CREATE TABLE public.assignment_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  answer_text TEXT,
  code_answer TEXT,
  code_output TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','submitted','late','reviewed')),
  submitted_at TIMESTAMPTZ,
  is_late BOOLEAN NOT NULL DEFAULT false,
  marks_obtained NUMERIC(6,2),
  teacher_feedback TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, student_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignment_submissions TO authenticated;
GRANT ALL ON public.assignment_submissions TO service_role;

ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view own submissions"
  ON public.assignment_submissions FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Students insert own submissions"
  ON public.assignment_submissions FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students update own draft"
  ON public.assignment_submissions FOR UPDATE TO authenticated
  USING (
    (student_id = auth.uid() AND status IN ('pending','submitted','late'))
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    (student_id = auth.uid() AND status IN ('pending','submitted','late'))
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins delete submissions"
  ON public.assignment_submissions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_assignment_submissions_updated_at
  BEFORE UPDATE ON public.assignment_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX assignment_submissions_assignment_idx ON public.assignment_submissions (assignment_id, status);
CREATE INDEX assignment_submissions_student_idx ON public.assignment_submissions (student_id);

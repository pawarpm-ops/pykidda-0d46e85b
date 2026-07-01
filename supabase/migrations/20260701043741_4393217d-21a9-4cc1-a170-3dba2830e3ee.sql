
CREATE TABLE public.problem_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_name TEXT,
  student_email TEXT,
  roll_number TEXT,
  problem_type TEXT NOT NULL,
  related_section TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'Medium',
  question_id TEXT,
  test_id TEXT,
  unit TEXT,
  topic TEXT,
  question_number TEXT,
  page_url TEXT,
  browser_info TEXT,
  screenshot_url TEXT,
  status TEXT NOT NULL DEFAULT 'Open',
  admin_remarks TEXT,
  admin_response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.problem_reports TO authenticated;
GRANT ALL ON public.problem_reports TO service_role;

ALTER TABLE public.problem_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own reports"
  ON public.problem_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own reports"
  ON public.problem_reports FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update reports"
  ON public.problem_reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete reports"
  ON public.problem_reports FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX problem_reports_user_id_idx ON public.problem_reports(user_id);
CREATE INDEX problem_reports_status_idx ON public.problem_reports(status);
CREATE INDEX problem_reports_created_at_idx ON public.problem_reports(created_at DESC);

CREATE TRIGGER update_problem_reports_updated_at
  BEFORE UPDATE ON public.problem_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.problem_reports;

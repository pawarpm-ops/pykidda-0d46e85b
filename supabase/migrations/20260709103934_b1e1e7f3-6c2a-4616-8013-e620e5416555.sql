
CREATE TABLE public.mock_test_attempt_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attempt_kind TEXT NOT NULL,
  attempt_id UUID NOT NULL,
  student_id UUID NOT NULL,
  teacher_id UUID NOT NULL,
  test_id TEXT NOT NULL,
  comment_text TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT mock_comment_kind_ck CHECK (attempt_kind IN ('normal','scheduled')),
  CONSTRAINT mock_comment_attempt_unique UNIQUE (attempt_kind, attempt_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mock_test_attempt_comments TO authenticated;
GRANT ALL ON public.mock_test_attempt_comments TO service_role;

ALTER TABLE public.mock_test_attempt_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all mock comments"
  ON public.mock_test_attempt_comments
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Students read own mock comments"
  ON public.mock_test_attempt_comments
  FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

CREATE TRIGGER mock_comment_touch
  BEFORE UPDATE ON public.mock_test_attempt_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX mock_comment_test_idx
  ON public.mock_test_attempt_comments (attempt_kind, test_id);
CREATE INDEX mock_comment_student_idx
  ON public.mock_test_attempt_comments (student_id);

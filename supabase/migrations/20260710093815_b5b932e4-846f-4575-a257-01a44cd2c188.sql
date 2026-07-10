
CREATE TABLE public.mock_test_attempt_comment_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id UUID NOT NULL REFERENCES public.mock_test_attempt_comments(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  author_role TEXT NOT NULL CHECK (author_role IN ('teacher','student')),
  body TEXT NOT NULL CHECK (length(trim(body)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mtacr_comment ON public.mock_test_attempt_comment_replies(comment_id, created_at);
CREATE INDEX idx_mtacr_author ON public.mock_test_attempt_comment_replies(author_id);

GRANT SELECT, INSERT ON public.mock_test_attempt_comment_replies TO authenticated;
GRANT ALL ON public.mock_test_attempt_comment_replies TO service_role;

ALTER TABLE public.mock_test_attempt_comment_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read replies on own or admin threads"
ON public.mock_test_attempt_comment_replies
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.mock_test_attempt_comments c
    WHERE c.id = comment_id AND c.student_id = auth.uid()
  )
);

CREATE POLICY "Student can reply on own thread"
ON public.mock_test_attempt_comment_replies
FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND author_role = 'student'
  AND EXISTS (
    SELECT 1 FROM public.mock_test_attempt_comments c
    WHERE c.id = comment_id AND c.student_id = auth.uid()
  )
);

CREATE POLICY "Admin can reply as teacher"
ON public.mock_test_attempt_comment_replies
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  AND author_role = 'teacher'
  AND author_id = auth.uid()
);

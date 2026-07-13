
CREATE TABLE public.homework (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  instructions TEXT,
  due_at TIMESTAMPTZ,
  allow_late_submission BOOLEAN NOT NULL DEFAULT true,
  total_marks NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','closed')),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.homework TO authenticated;
GRANT ALL ON public.homework TO service_role;
ALTER TABLE public.homework ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students view published homework" ON public.homework FOR SELECT TO authenticated
  USING (status IN ('published','closed') OR created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins insert homework" ON public.homework FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') AND created_by = auth.uid());
CREATE POLICY "Admins update homework" ON public.homework FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete homework" ON public.homework FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_homework_updated_at BEFORE UPDATE ON public.homework
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_homework_status ON public.homework(status);
CREATE INDEX idx_homework_created_by ON public.homework(created_by);

CREATE TABLE public.homework_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  homework_id UUID NOT NULL REFERENCES public.homework(id) ON DELETE CASCADE,
  question_order INTEGER NOT NULL DEFAULT 1,
  question_type TEXT NOT NULL CHECK (question_type IN ('coding','short_answer','mcq','descriptive','practice')),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  marks NUMERIC NOT NULL DEFAULT 1,
  difficulty TEXT NOT NULL DEFAULT 'easy' CHECK (difficulty IN ('easy','medium','hard')),
  input_format TEXT, output_format TEXT, sample_input TEXT, sample_output TEXT,
  test_cases JSONB NOT NULL DEFAULT '[]'::jsonb, hints TEXT,
  mcq_options JSONB, mcq_correct TEXT, starter_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.homework_questions TO authenticated;
GRANT ALL ON public.homework_questions TO service_role;
ALTER TABLE public.homework_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read questions when hw visible" ON public.homework_questions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.homework h WHERE h.id = homework_id
    AND (h.status IN ('published','closed') OR h.created_by = auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "Admins manage questions" ON public.homework_questions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_hwq_updated_at BEFORE UPDATE ON public.homework_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_hwq_hw ON public.homework_questions(homework_id, question_order);

CREATE OR REPLACE FUNCTION public.recalc_homework_total_marks()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _hw UUID;
BEGIN
  _hw := COALESCE(NEW.homework_id, OLD.homework_id);
  UPDATE public.homework SET total_marks =
    COALESCE((SELECT SUM(marks) FROM public.homework_questions WHERE homework_id = _hw),0)
    WHERE id = _hw;
  RETURN NULL;
END; $$;
CREATE TRIGGER trg_recalc_hw_marks AFTER INSERT OR UPDATE OF marks OR DELETE ON public.homework_questions
FOR EACH ROW EXECUTE FUNCTION public.recalc_homework_total_marks();

CREATE TABLE public.homework_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  homework_id UUID NOT NULL REFERENCES public.homework(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  submitted_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'not_submitted'
    CHECK (status IN ('not_submitted','submitted','late','checked','returned')),
  is_late BOOLEAN NOT NULL DEFAULT false,
  total_marks_obtained NUMERIC,
  teacher_feedback TEXT,
  checked_by UUID REFERENCES auth.users(id),
  checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(homework_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.homework_submissions TO authenticated;
GRANT ALL ON public.homework_submissions TO service_role;
ALTER TABLE public.homework_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own submissions" ON public.homework_submissions FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Insert own submissions" ON public.homework_submissions FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());
CREATE POLICY "Update own submissions" ON public.homework_submissions FOR UPDATE TO authenticated
  USING (student_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (student_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin delete submissions" ON public.homework_submissions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_hws_updated_at BEFORE UPDATE ON public.homework_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_hws_hw ON public.homework_submissions(homework_id);
CREATE INDEX idx_hws_student ON public.homework_submissions(student_id);

CREATE TABLE public.homework_question_answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES public.homework_submissions(id) ON DELETE CASCADE,
  homework_question_id UUID NOT NULL REFERENCES public.homework_questions(id) ON DELETE CASCADE,
  student_answer TEXT, student_code TEXT, execution_output TEXT,
  marks_awarded NUMERIC, teacher_comment TEXT, auto_check_result JSONB,
  checked_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (checked_status IN ('pending','checked','needs_review')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(submission_id, homework_question_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.homework_question_answers TO authenticated;
GRANT ALL ON public.homework_question_answers TO service_role;
ALTER TABLE public.homework_question_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View answers via submission" ON public.homework_question_answers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.homework_submissions s WHERE s.id = submission_id
    AND (s.student_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "Insert own answers" ON public.homework_question_answers FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.homework_submissions s WHERE s.id = submission_id AND s.student_id = auth.uid()));
CREATE POLICY "Update own answers" ON public.homework_question_answers FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.homework_submissions s WHERE s.id = submission_id
    AND (s.student_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.homework_submissions s WHERE s.id = submission_id
    AND (s.student_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "Admin delete answers" ON public.homework_question_answers FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_hqa_updated_at BEFORE UPDATE ON public.homework_question_answers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_hqa_sub ON public.homework_question_answers(submission_id);
CREATE INDEX idx_hqa_q ON public.homework_question_answers(homework_question_id);

CREATE OR REPLACE FUNCTION public.protect_hw_answer_grading()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.role() = 'service_role' OR public.has_role(auth.uid(),'admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.marks_awarded IS DISTINCT FROM OLD.marks_awarded
     OR NEW.teacher_comment IS DISTINCT FROM OLD.teacher_comment
     OR NEW.checked_status IS DISTINCT FROM OLD.checked_status THEN
    RAISE EXCEPTION 'Not allowed to modify grading fields';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_protect_hqa BEFORE UPDATE ON public.homework_question_answers
FOR EACH ROW EXECUTE FUNCTION public.protect_hw_answer_grading();

CREATE OR REPLACE FUNCTION public.protect_hw_submission_grading()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.role() = 'service_role' OR public.has_role(auth.uid(),'admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.teacher_feedback IS DISTINCT FROM OLD.teacher_feedback
     OR NEW.checked_by IS DISTINCT FROM OLD.checked_by
     OR NEW.checked_at IS DISTINCT FROM OLD.checked_at
     OR (NEW.status = 'checked' AND OLD.status IS DISTINCT FROM 'checked')
     OR (NEW.status = 'returned' AND OLD.status IS DISTINCT FROM 'returned') THEN
    RAISE EXCEPTION 'Not allowed to modify grading fields';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_protect_hws BEFORE UPDATE ON public.homework_submissions
FOR EACH ROW EXECUTE FUNCTION public.protect_hw_submission_grading();

CREATE OR REPLACE FUNCTION public.recalc_hw_submission_total()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sub UUID;
BEGIN
  _sub := COALESCE(NEW.submission_id, OLD.submission_id);
  UPDATE public.homework_submissions
     SET total_marks_obtained = (SELECT COALESCE(SUM(marks_awarded),0)
        FROM public.homework_question_answers
        WHERE submission_id = _sub AND marks_awarded IS NOT NULL)
   WHERE id = _sub;
  RETURN NULL;
END; $$;
CREATE TRIGGER trg_recalc_hw_sub_total AFTER INSERT OR UPDATE OF marks_awarded OR DELETE
ON public.homework_question_answers
FOR EACH ROW EXECUTE FUNCTION public.recalc_hw_submission_total();

-- Backfill
INSERT INTO public.homework (id, title, description, instructions, due_at, allow_late_submission, status, created_by, created_at, updated_at)
SELECT a.id, a.title, COALESCE(a.description,''), a.instructions, a.due_at, a.allow_late_submission,
  CASE WHEN a.status IN ('draft','published','closed') THEN a.status ELSE 'draft' END,
  a.created_by, a.created_at, a.updated_at
FROM public.assignments a
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.homework_questions
  (homework_id, question_order, question_type, title, description, marks, difficulty,
   input_format, output_format, sample_input, sample_output, test_cases, hints, starter_code)
SELECT a.id, 1,
  CASE WHEN a.assignment_type IN ('coding','short_answer','mcq','descriptive','practice')
    THEN a.assignment_type ELSE 'coding' END,
  a.title, COALESCE(a.description,''), a.total_marks,
  CASE WHEN a.difficulty IN ('easy','medium','hard') THEN a.difficulty ELSE 'easy' END,
  a.input_format, a.output_format, a.sample_input, a.sample_output,
  COALESCE(a.test_cases,'[]'::jsonb), a.hints, a.starter_code
FROM public.assignments a
WHERE NOT EXISTS (SELECT 1 FROM public.homework_questions q WHERE q.homework_id = a.id);

INSERT INTO public.homework_submissions
  (id, homework_id, student_id, submitted_at, status, is_late,
   total_marks_obtained, teacher_feedback, checked_by, checked_at, created_at, updated_at)
SELECT s.id, s.assignment_id, s.student_id, s.submitted_at,
  CASE WHEN s.status='reviewed' THEN 'checked'
       WHEN s.status='late' THEN 'late'
       WHEN s.status='submitted' THEN 'submitted'
       ELSE 'not_submitted' END,
  s.is_late, s.marks_obtained, s.teacher_feedback, s.reviewed_by, s.reviewed_at, s.created_at, s.updated_at
FROM public.assignment_submissions s
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.homework_question_answers
  (submission_id, homework_question_id, student_answer, student_code, execution_output,
   marks_awarded, teacher_comment, checked_status)
SELECT s.id, q.id, s.answer_text, s.code_answer, s.code_output,
  s.marks_obtained, s.teacher_feedback,
  CASE WHEN s.status='reviewed' THEN 'checked' ELSE 'pending' END
FROM public.assignment_submissions s
JOIN public.homework_questions q ON q.homework_id = s.assignment_id
WHERE NOT EXISTS (SELECT 1 FROM public.homework_question_answers a
  WHERE a.submission_id = s.id AND a.homework_question_id = q.id);

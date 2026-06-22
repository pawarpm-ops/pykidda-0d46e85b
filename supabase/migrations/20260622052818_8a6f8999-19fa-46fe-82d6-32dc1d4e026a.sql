
-- 1. Role system -----------------------------------------------------------
CREATE TYPE public.app_role AS ENUM ('admin', 'student');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 2. Mock results (cross-student) -----------------------------------------
CREATE TABLE public.mock_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  test_id text NOT NULL,
  test_name text NOT NULL,
  student_name text,
  marks_obtained integer NOT NULL DEFAULT 0,
  total_marks integer NOT NULL DEFAULT 0,
  percentage integer NOT NULL DEFAULT 0,
  grade text NOT NULL DEFAULT 'F',
  total_questions integer NOT NULL DEFAULT 0,
  time_taken_sec integer NOT NULL DEFAULT 0,
  submission_type text NOT NULL DEFAULT 'normal',
  violation_reason text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.mock_results TO authenticated;
GRANT ALL ON public.mock_results TO service_role;
ALTER TABLE public.mock_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students insert own mock results" ON public.mock_results
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Students read own mock results" ON public.mock_results
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read all mock results" ON public.mock_results
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX mock_results_user_idx ON public.mock_results(user_id, submitted_at DESC);
CREATE INDEX mock_results_test_idx ON public.mock_results(test_id);

-- 3. Practice attempts (cross-student) ------------------------------------
CREATE TABLE public.practice_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id text NOT NULL,
  unit integer NOT NULL,
  passed integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  solved boolean NOT NULL DEFAULT false,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.practice_attempts TO authenticated;
GRANT ALL ON public.practice_attempts TO service_role;
ALTER TABLE public.practice_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students insert own practice" ON public.practice_attempts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Students read own practice" ON public.practice_attempts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read all practice" ON public.practice_attempts
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX practice_attempts_user_idx ON public.practice_attempts(user_id, attempted_at DESC);

-- 4. Announcements (admin → students) -------------------------------------
CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  priority text NOT NULL DEFAULT 'normal',
  target_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.announcements TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Students see broadcasts and ones targeted at them
CREATE POLICY "Users read relevant announcements" ON public.announcements
  FOR SELECT TO authenticated
  USING (target_user_id IS NULL OR target_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins create announcements" ON public.announcements
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND auth.uid() = author_id);
CREATE POLICY "Admins update own announcements" ON public.announcements
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') AND auth.uid() = author_id)
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND auth.uid() = author_id);
CREATE POLICY "Admins delete own announcements" ON public.announcements
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') AND auth.uid() = author_id);

CREATE INDEX announcements_created_idx ON public.announcements(created_at DESC);
CREATE INDEX announcements_target_idx ON public.announcements(target_user_id);

-- 5. Read receipts -------------------------------------------------------
CREATE TABLE public.announcement_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (announcement_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.announcement_reads TO authenticated;
GRANT ALL ON public.announcement_reads TO service_role;
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own reads" ON public.announcement_reads
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6. Auto-assign 'student' on signup; promote admin email ----------------
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN NEW.email = 'siddhustudyhard@gmail.com' THEN 'admin'::public.app_role ELSE 'student'::public.app_role END)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- 7. Backfill: any existing user gets a student role; admin email gets admin
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'student'::public.app_role FROM auth.users
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users WHERE email = 'siddhustudyhard@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Clear existing auto-generated roll numbers so admins can assign them manually.
UPDATE public.profiles SET student_unique_id = NULL WHERE student_unique_id IS NOT NULL;
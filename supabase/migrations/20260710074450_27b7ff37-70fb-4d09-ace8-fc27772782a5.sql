
REVOKE EXECUTE ON FUNCTION public.protect_submission_grade_fields() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_student_directory(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_student_directory(uuid[]) TO authenticated, service_role;

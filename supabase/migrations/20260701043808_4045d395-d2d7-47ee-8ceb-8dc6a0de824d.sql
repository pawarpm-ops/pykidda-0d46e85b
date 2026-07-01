
CREATE POLICY "Users can upload their own report screenshots"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'report-screenshots'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own report screenshots"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'report-screenshots'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin')
    )
  );

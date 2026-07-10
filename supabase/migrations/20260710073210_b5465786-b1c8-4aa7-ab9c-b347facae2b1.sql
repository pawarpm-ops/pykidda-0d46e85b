CREATE TABLE public.user_seen_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('announcement','homework','mock_test')),
  item_id UUID NOT NULL,
  seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_type, item_id)
);

CREATE INDEX idx_user_seen_updates_user ON public.user_seen_updates(user_id, item_type);

GRANT SELECT, INSERT ON public.user_seen_updates TO authenticated;
GRANT ALL ON public.user_seen_updates TO service_role;

ALTER TABLE public.user_seen_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own seen updates"
  ON public.user_seen_updates FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can mark items as seen"
  ON public.user_seen_updates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
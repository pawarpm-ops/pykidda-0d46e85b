
CREATE TABLE public.leaderboard_scores (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  score INTEGER NOT NULL DEFAULT 0,
  solved_count INTEGER NOT NULL DEFAULT 0,
  mock_best INTEGER NOT NULL DEFAULT 0,
  mocks_taken INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.leaderboard_scores TO authenticated;
GRANT ALL ON public.leaderboard_scores TO service_role;

ALTER TABLE public.leaderboard_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can view leaderboard"
  ON public.leaderboard_scores FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own score"
  ON public.leaderboard_scores FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own score"
  ON public.leaderboard_scores FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_leaderboard_scores_updated_at
  BEFORE UPDATE ON public.leaderboard_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX leaderboard_scores_score_idx ON public.leaderboard_scores (score DESC);

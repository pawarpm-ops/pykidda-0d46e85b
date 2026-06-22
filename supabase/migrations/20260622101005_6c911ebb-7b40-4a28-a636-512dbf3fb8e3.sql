DROP POLICY IF EXISTS "Users can insert their own score" ON public.leaderboard_scores;
DROP POLICY IF EXISTS "Users can update their own score" ON public.leaderboard_scores;
REVOKE INSERT, UPDATE, DELETE ON public.leaderboard_scores FROM authenticated;
GRANT SELECT ON public.leaderboard_scores TO authenticated;

ALTER TABLE public.leaderboard_scores
  DROP CONSTRAINT IF EXISTS leaderboard_scores_bounds_chk;
ALTER TABLE public.leaderboard_scores
  ADD CONSTRAINT leaderboard_scores_bounds_chk
  CHECK (
    score >= 0 AND score <= 100000
    AND solved_count >= 0 AND solved_count <= 100000
    AND mock_best >= 0 AND mock_best <= 100
    AND mocks_taken >= 0 AND mocks_taken <= 100000
  );

ALTER TABLE public.mock_results
  DROP CONSTRAINT IF EXISTS mock_results_bounds_chk;
ALTER TABLE public.mock_results
  ADD CONSTRAINT mock_results_bounds_chk
  CHECK (
    percentage >= 0 AND percentage <= 100
    AND marks_obtained >= 0
    AND total_marks >= 0
    AND marks_obtained <= total_marks
    AND total_questions >= 0
    AND time_taken_sec >= 0
  );

ALTER TABLE public.practice_attempts
  DROP CONSTRAINT IF EXISTS practice_attempts_bounds_chk;
ALTER TABLE public.practice_attempts
  ADD CONSTRAINT practice_attempts_bounds_chk
  CHECK (
    passed >= 0 AND total >= 0 AND passed <= total
    AND unit >= 0 AND unit <= 50
  );
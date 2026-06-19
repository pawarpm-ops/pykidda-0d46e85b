## Goal

Throw out the current Practice question set and difficulty-level UX. Rebuild Practice as a single flat list of Python coding questions drawn from your uploaded syllabus PDF, each with deterministic stdin/expected test cases that run in the existing Pyodide runner.

## Question selection (from the PDF)

Only include questions that can be auto-graded with code + test cases. Conceptual "Explain…" / "Compare…" / questions requiring GUI (tkinter), file I/O on disk, plotting (matplotlib/seaborn), CSV/Pandas datasets, or screenshots are skipped.

Final set (~18 questions, flat list, numbered, tagged with Unit for reference only):

- U1: Prime check with exception handling
- U2: Sum of integers in a mixed list (try/except)
- U2: Vowel count per word → dict
- U2: Valid identifier / email / URL checker
- U2: Count digits/alphabets/whitespace/special chars → dict
- U2: Primes from a list
- U2: Simple calculator (+ − × ÷, divide-by-zero handled)
- U2: Word-count dictionary from a sentence
- U2: Uppercase + vowel count + palindrome check
- U2: Even/odd + factorial + prime
- U3: Student class (name, roll, marks) — print details
- U3: Circle class with area()
- U3: Account class with deposit/withdraw transactions
- U3: Rectangle → Cuboid (area, perimeter, surface area, volume)
- U3: Vehicle/Bike/Car polymorphism via start_engine()
- U4: Current month name (datetime)
- U4: 4×4 random matrix → row & column sums (fixed seed for determinism)
- U4: Days remaining until a user-specified date (datetime)

Each question gets: `id`, `unit`, `title`, `prompt`, `starterCode`, `tests[]` (stdin/expected), `hint`, `solution`, `marks` (default 4, 8 for the larger ones matching the PDF).

## Removed concepts

- `Difficulty` type, `easy`/`medium`/`hard` everywhere.
- `questionsByDifficulty()` helper.
- Routes: `practice.$difficulty.tsx`, `practice.$difficulty.$qid.tsx`, `practice.index.tsx` (all replaced).
- Difficulty card grid on home page → replaced with one "Practice" CTA.
- Difficulty breakdown in Analytics → replaced with overall solved / attempts / accuracy.
- Difficulty filter in Mock Test generator (if any) → mock tests now pull from the flat pool.

## New routes

- `src/routes/_authenticated/practice.index.tsx` — flat list of all questions: number, title, unit badge, marks, solved ✓ indicator. One-click → opens question.
- `src/routes/_authenticated/practice.$qid.tsx` — single question page with prompt, editor, Run, Submit, 💡 Know what's wrong, 🔧 Fix this AI (existing CodeRunner unchanged).

Old `practice.$difficulty.*` files deleted.

## Files changed

- `src/lib/questions.ts` — rewrite QUESTIONS array, drop `Difficulty`, drop `questionsByDifficulty`.
- `src/lib/progress.ts` — drop `byDifficulty`, keep totals.
- `src/routes/_authenticated/practice.index.tsx` — flat list UI.
- `src/routes/_authenticated/practice.$qid.tsx` — new.
- Delete `src/routes/_authenticated/practice.$difficulty.tsx` and `practice.$difficulty.$qid.tsx`.
- `src/routes/index.tsx` — replace 3 difficulty cards with single Practice card; update meta copy.
- `src/routes/_authenticated/analytics.tsx` — remove "By difficulty" block; show overall + per-unit instead.
- `src/routes/mock-tests.*` (if difficulty is referenced) — use flat pool, pick N random.

## Not touched

- Pyodide runner, CodeRunner UI, AI feedback / Fix buttons, mock-test anti-cheat, leaderboard scoring (still sums marks of uniquely-solved questions — works unchanged).

Confirm and I'll build it.

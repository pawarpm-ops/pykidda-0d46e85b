// Pyko AI — verified knowledge registry for Guide mode.
// Server-only. Hard-coded, human-curated route descriptions so the model
// never hallucinates PY Kidda features. If a route isn't listed here, the
// guide should defer to the Help page rather than invent an answer.

export type PykoRouteFact = {
  path: string;
  title: string;
  whatItDoes: string;
  whenToUse: string;
  related?: string[];
};

export const PYKO_ROUTE_FACTS: PykoRouteFact[] = [
  { path: "/", title: "Home", whatItDoes: "Landing page with a quick tour of PY Kidda features.", whenToUse: "First visit, or to jump into a feature." },
  { path: "/auth", title: "Sign in / Sign up", whatItDoes: "Sign in with Google or email; new accounts are created here.", whenToUse: "You're signed out." },
  { path: "/dashboard", title: "Dashboard", whatItDoes: "Your daily overview: streak, next badge, recent activity, quick links to homework and practice.", whenToUse: "Starting a study session." },
  { path: "/practice", title: "Practice questions", whatItDoes: "Browse Python practice questions by unit and difficulty. Solving one counts toward your streak.", whenToUse: "You want to build skill on a topic." },
  { path: "/homework", title: "Homework", whatItDoes: "Assigned coding homework with due dates. Submit before the deadline to avoid a late tag.", whenToUse: "Your teacher has set a task." },
  { path: "/mock-tests", title: "Mock tests", whatItDoes: "Full-length practice tests. Standard, AI-generated, and scheduled tests all live here.", whenToUse: "You want exam-style practice." },
  { path: "/badges", title: "Badges", whatItDoes: "Achievement gallery with categories, tiers and progress. Some badges are secret.", whenToUse: "Track achievements and next targets." },
  { path: "/leaderboard", title: "Leaderboard", whatItDoes: "Ranks students by their best scores on scheduled mock tests (not practice or homework).", whenToUse: "Compare your test performance." },
  { path: "/profile", title: "Profile", whatItDoes: "Your profile, streak, badges, reports, tutorial and settings live in the vertical sidebar.", whenToUse: "Manage account or view stats." },
  { path: "/help", title: "Help", whatItDoes: "Guides for common questions about PY Kidda features.", whenToUse: "You need step-by-step instructions." },
];

const RULES = [
  "Streaks: opening practice, homework, or a mock test, or solving/submitting any of them, counts toward today's streak. One missed day resets it unless a monthly streak freeze is available.",
  "Leaderboard scoring: only best scores on scheduled mock tests count. Practice and homework do not affect leaderboard rank.",
  "Badges: earned automatically as you cross thresholds; a celebration pops up after your test is submitted, never during one.",
  "Assessments: while a mock test is in progress, Pyko is paused and cannot answer any questions. Submit or exit the test to continue.",
  "Privacy: chats may be stored to improve Pyko. Do not share passwords or personal info.",
];

export function guideKnowledgeBlock(currentRoute?: string): string {
  const lines = PYKO_ROUTE_FACTS.map(
    (r) => `- ${r.path} (${r.title}): ${r.whatItDoes} ${r.whenToUse}`,
  );
  const here = currentRoute ? `\n\nStudent is currently on: ${currentRoute}` : "";
  return `Verified PY Kidda facts (only answer from this list; if unsure, say so and point to /help):\n${lines.join(
    "\n",
  )}\n\nRules:\n${RULES.map((r) => `- ${r}`).join("\n")}${here}`;
}

// Deterministic fallback when the model returns nothing useful.
export function guideFallback(query: string): string {
  const q = query.toLowerCase();
  const hit = PYKO_ROUTE_FACTS.find(
    (r) => q.includes(r.title.toLowerCase()) || q.includes(r.path.replace("/", "")),
  );
  if (hit) return `${hit.title} lives at ${hit.path}. ${hit.whatItDoes}`;
  return "I'm not sure about that yet — try the Help page (/help) for step-by-step guides.";
}

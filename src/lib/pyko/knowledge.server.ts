// Pyko AI — verified knowledge registry for Guide mode.
// Server-only. Hard-coded, human-curated route + workflow descriptions so the
// model never hallucinates PY Kidda features. Every fact reflects what is
// actually implemented in this codebase.

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
  { path: "/practice", title: "Practice questions", whatItDoes: "Browse Python practice questions grouped by unit. Opening the list and solving a question both count toward your streak.", whenToUse: "You want to build skill on a topic." },
  { path: "/homework", title: "Homework", whatItDoes: "Assigned coding homework with due dates. Open, solve in-browser, submit. Late submissions are tagged 'late'.", whenToUse: "Your teacher has assigned a task." },
  { path: "/assignments", title: "Assignments", whatItDoes: "Longer coding assignments; each has its own detail page with questions, submission and teacher feedback.", whenToUse: "You have an open assignment." },
  { path: "/mock-tests", title: "Mock tests", whatItDoes: "Full-length practice tests. Standard, AI-generated, and scheduled tests all live here.", whenToUse: "You want exam-style practice." },
  { path: "/badges", title: "Badges", whatItDoes: "Achievement gallery with categories, tiers and progress. Some badges are secret.", whenToUse: "Track achievements and next targets." },
  { path: "/leaderboard", title: "Leaderboard", whatItDoes: "Ranks students by their best scores on scheduled mock tests only (practice and homework do not affect rank).", whenToUse: "Compare your scheduled-test performance." },
  { path: "/profile", title: "Profile", whatItDoes: "Vertical sidebar with your profile, streak, badges, reports and the website tutorial.", whenToUse: "Manage your account or view stats." },
  { path: "/notifications", title: "Notifications", whatItDoes: "Inbox of announcements (homework, mock tests, practice, teacher feedback). Each item has a View button that jumps to the relevant page.", whenToUse: "Check what's new." },
  { path: "/streak-journey", title: "Streak Journey", whatItDoes: "Timeline of your daily streak, freezes used and longest run.", whenToUse: "See streak history." },
  { path: "/help", title: "Help", whatItDoes: "Guides for common questions about PY Kidda features.", whenToUse: "You need step-by-step instructions." },
];

const RULES = [
  "Streaks: opening practice, homework, or a mock test, or solving/submitting any of them, counts toward today's streak. One missed day resets it unless a monthly streak freeze is available.",
  "Leaderboard scoring: only the sum of best percentages on scheduled mock tests count. Practice, homework and non-scheduled mocks do not affect leaderboard rank.",
  "Badges: earned automatically as you cross thresholds; a celebration pops up after your test is submitted, never during one.",
  "Assessments: while a mock test is in progress, Pyko is paused and cannot answer any questions. Submit or exit the test to continue.",
  "Notifications: homework, assignments, practice-question and mock-test publish events all appear here with a View button that deep-links to the item.",
  "Privacy: chats may be stored to improve Pyko. Do not share passwords or personal info.",
];

// Verified end-to-end workflows. Each entry describes what actually exists in
// the current codebase (routes under src/routes/_authenticated/admin.* +
// server fns under src/lib/*.functions.ts). Keep this in sync with real UI.
type Walkthrough = { title: string; roles: string; steps: string[] };

const PROCESS_WALKTHROUGHS: Record<string, Walkthrough> = {
  homework_create: {
    title: "How teachers create and assign homework",
    roles: "Admin or teacher role only (students can only view and submit).",
    steps: [
      "Open the Admin dashboard from Profile → Admin, then click Homework.",
      "On /admin/homework click 'New homework' — this opens the homework editor.",
      "Fill Title and Description. The homework editor does not ask for a due date or total marks up-front — marks are computed from the questions you add.",
      "Choose the target audience: all students or a specific list.",
      "Under Questions click 'Add question'. Only coding questions are supported (descriptive questions have been removed). Type the problem statement — the first line becomes the auto-title; do NOT enter a separate title, starter code, or difficulty field, those inputs no longer exist. The hidden tests and reference solution used for auto-grading stay server-side and are never shown to students.",
      "Save each question, then click 'Publish' on the homework. Publishing inserts an announcement into every student's Notifications with a View button linking to /homework/<id>.",
      "Students open /homework, click the item, write code in the two-column editor, click Run Tests / Submit. The auto-grader records how many hidden tests passed.",
      "Teachers open /admin/homework/<id>, review each submission, add comments and either 'Check' (finalise) or 'Return for correction'. Homework past its due date automatically moves to the Closed tab; drafts stay drafts. The student gets a notification with a View button linking back to their homework.",
    ],
  },
  homework_submit: {
    title: "How students submit homework",
    roles: "Any signed-in student.",
    steps: [
      "Open /homework (or click View in the notification).",
      "Click the homework card to open the detail page.",
      "For each coding question, write your Python code in the editor on the right.",
      "Click Run Tests. Pyodide runs your code in the browser against visible tests and records the result.",
      "Fix any failures, then click Submit. Late submissions are tagged 'late' but still accepted if the teacher enabled late submission.",
      "After the teacher reviews, you'll get a notification. Open Homework to read the teacher's comment; if returned for correction you can resubmit.",
    ],
  },
  practice_create: {
    title: "How practice questions are created",
    roles: "Admin only.",
    steps: [
      "Open /admin/practice.",
      "Click 'New question'. Enter unit, title, prompt, starter code, marks and any hint or reference solution.",
      "Add one or more test cases (stdin + expected output). These stay server-side; students never see them.",
      "Save as Draft or click Publish. Publishing inserts an announcement with a View button linking to /practice/db-<id>.",
      "Students find the question under /practice grouped by unit and solve it in the browser. Practice attempts are for self-learning only and are not stored on the server.",
    ],
  },
  mock_scheduled: {
    title: "How scheduled mock tests work",
    roles: "Admin creates the test; students take it during the scheduled window.",
    steps: [
      "Admin opens /admin/ai-mock, clicks 'New test', chooses kind = 'scheduled', sets title, questions, total marks, scheduled_start_at and scheduled_end_at.",
      "Publishing a scheduled test inserts a high-priority announcement linking to /mock-tests/scheduled/<id>.",
      "Students see it in /mock-tests. Between start and end they can open the warning page, then take the test at /mock-tests/scheduled/<id>.",
      "During the test Pyko is paused (pyko_assessment_sessions is active). No badge or streak popup appears until submit.",
      "On submit the score is written to mock_results. The leaderboard uses only the best percentage per scheduled test.",
    ],
  },
  streaks: {
    title: "How the streak system works",
    roles: "All students.",
    steps: [
      "Any of these actions counts today's streak: opening /practice, /homework or a mock test; solving a practice question; submitting homework; attempting a mock test.",
      "The RPC record_streak_activity runs each time — it updates student_streaks.current_streak and last_activity_date (Asia/Kolkata timezone).",
      "Miss a day and the streak resets, unless you have a streak freeze. One freeze is granted per calendar month and is auto-applied when there is a single missed day.",
      "Longest streak, current streak, freezes-available and warnings are visible on /streak-journey and in the profile sidebar.",
    ],
  },
  grading: {
    title: "How teachers grade / return homework",
    roles: "Admin or teacher role only.",
    steps: [
      "Open /admin/homework, pick the homework, then a submission.",
      "Review each answer. Add a teacher comment.",
      "Choose 'Check' to finalise, or 'Return for correction' to send it back so the student can resubmit.",
      "Either action inserts a targeted notification (target_user_id = student) with a View button linking to /homework/<id>.",
      "Grading fields (marks_awarded, teacher_comment, checked_status) are protected by the protect_hw_answer_grading trigger — students cannot self-award marks.",
    ],
  },
};

// Structured intent → walkthrough routing. We resolve (topic, action) from
// the query and pick a walkthrough. This replaces the old substring keyword
// matcher, which misclassified "where is homework" and "submit homework" as
// homework creation because the normaliser stripped "where"/"submit".
import { resolveIntent, isCreateIntent, type GuideIntent, type GuideTopic } from "./intent";

function pickWalkthroughKey(intent: GuideIntent): keyof typeof PROCESS_WALKTHROUGHS | null {
  const { topic, action } = intent;
  if (!topic) return null;

  if (topic === "homework") {
    if (isCreateIntent(intent)) return "homework_create";
    if (action === "submit" || action === "attempt") return "homework_submit";
    if (action === "grade" || action === "review" || action === "return") return "grading";
    return null; // navigation / explain → let route facts answer
  }
  if (topic === "practice") {
    if (isCreateIntent(intent)) return "practice_create";
    return null;
  }
  if (topic === "scheduled_mock" || topic === "mock_test") {
    if (action === "explain" || action === "attempt" || action === "navigate" || isCreateIntent(intent) || action === "unknown") {
      return "mock_scheduled";
    }
    return "mock_scheduled";
  }
  if (topic === "streak") {
    if (action === "explain" || action === "navigate" || action === "unknown") return "streaks";
    return "streaks";
  }
  return null;
}

export function getProcessWalkthrough(query: string): Walkthrough | null {
  const intent = resolveIntent(query);
  const key = pickWalkthroughKey(intent);
  return key ? PROCESS_WALKTHROUGHS[key] : null;
}

function walkthroughText(w: Walkthrough): string {
  const numbered = w.steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
  return `Verified process — ${w.title}\nWho can do this: ${w.roles}\n${numbered}`;
}

// Short factual answers for topic + navigation/explain intents where a full
// walkthrough would be overkill (e.g. "where is homework?", "what is streak?").
const TOPIC_TO_ROUTE: Partial<Record<GuideTopic, string>> = {
  homework: "/homework",
  practice: "/practice",
  assignment: "/assignments",
  mock_test: "/mock-tests",
  scheduled_mock: "/mock-tests",
  ai_mock: "/mock-tests",
  badge: "/badges",
  leaderboard: "/leaderboard",
  notification: "/notifications",
  profile: "/profile",
  streak: "/streak-journey",
  help: "/help",
  auth: "/auth",
};

export function guideKnowledgeBlock(currentRoute?: string, userMessage?: string): string {
  const lines = PYKO_ROUTE_FACTS.map(
    (r) => `- ${r.path} (${r.title}): ${r.whatItDoes} ${r.whenToUse}`,
  );
  const here = currentRoute ? `\n\nStudent is currently on: ${currentRoute}` : "";
  const wt = userMessage ? getProcessWalkthrough(userMessage) : null;
  const walkthrough = wt ? `\n\n${walkthroughText(wt)}` : "";
  return `Verified PY Kidda facts (only answer from this list; if unsure, say so):\n${lines.join(
    "\n",
  )}\n\nRules:\n${RULES.map((r) => `- ${r}`).join("\n")}${here}${walkthrough}`;
}

// Deterministic fallback when the model returns nothing useful.
export function guideFallback(query: string): string {
  const wt = getProcessWalkthrough(query);
  if (wt) return walkthroughText(wt);
  const intent = resolveIntent(query);
  if (intent.topic) {
    const route = TOPIC_TO_ROUTE[intent.topic];
    const fact = route ? PYKO_ROUTE_FACTS.find((r) => r.path === route) : null;
    if (fact) return `${fact.title} lives at ${fact.path}. ${fact.whatItDoes}`;
  }
  return "I couldn't map that to a PY Kidda feature. If it's a Python concept or a code error, switch to AI Teacher or All-Rounder for a detailed answer — otherwise try rephrasing (for example: \"how do I create homework\", \"how do streaks work\").";
}

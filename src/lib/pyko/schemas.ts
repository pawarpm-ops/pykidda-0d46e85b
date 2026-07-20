// Pyko AI — shared Zod schemas.
// Client-safe: no server-only imports. Reuse these for both request validation
// (inside server functions) and future client wiring.

import { z } from "zod";

export const PykoMode = z.enum([
  "guide",
  "tutor",
  "corrector",
  "coach",
  "teacher",
  "allrounder",
]);
export type PykoMode = z.infer<typeof PykoMode>;

// Only student-selectable modes. `teacher` (Teacher Copilot) is admin-only
// and gated by assertModeAllowedForUser; `corrector` and `coach` are
// internal sub-modes resolved by the All-Rounder router.
export const PykoStudentMode = z.enum(["guide", "tutor", "allrounder"]);
export type PykoStudentMode = z.infer<typeof PykoStudentMode>;

export const PykoPageContext = z
  .object({
    route: z.string().max(200).optional(),
    questionId: z.string().max(80).optional(),
    homeworkId: z.string().uuid().optional(),
    assignmentId: z.string().uuid().optional(),
    mockTestId: z.string().max(80).optional(),
    unit: z.number().int().min(1).max(20).optional(),
  })
  .strict()
  .default({});
export type PykoPageContext = z.infer<typeof PykoPageContext>;

export const PykoChatInput = z
  .object({
    conversationId: z.string().uuid().optional(),
    mode: PykoMode,
    message: z.string().min(1).max(4000),
    // Optional pasted student code for AI Teacher / All-Rounder corrector.
    // Trusted-input only: this is the student's own draft, never hidden tests
    // or reference solutions. Strict schema rejects any other key.
    code: z.string().max(8000).optional(),
    language: z.enum(["python"]).optional(),
    pageContext: PykoPageContext.optional(),
    retry: z.boolean().optional(),
  })
  .strict();
export type PykoChatInput = z.infer<typeof PykoChatInput>;

export const PykoSubMode = z.enum(["guide", "tutor", "corrector", "coach"]);
export type PykoSubMode = z.infer<typeof PykoSubMode>;

export const PykoChatOutput = z.object({
  conversationId: z.string().uuid(),
  messageId: z.string().uuid(),
  traceId: z.string(),
  content: z.string(),
  mode: PykoMode,
  subMode: PykoSubMode.optional(),
  fallback: z.boolean().default(false),
});
export type PykoChatOutput = z.infer<typeof PykoChatOutput>;

export const PykoAssessmentType = z.enum(["standard", "ai", "scheduled"]);
export type PykoAssessmentType = z.infer<typeof PykoAssessmentType>;

export const PykoAssessmentStart = z.object({
  assessmentId: z.string().min(1).max(120),
  type: PykoAssessmentType,
  durationMinutes: z.number().int().min(1).max(480).default(120),
});
export type PykoAssessmentStart = z.infer<typeof PykoAssessmentStart>;

export const PykoAssessmentEnd = z.object({
  assessmentId: z.string().min(1).max(120),
  reason: z.enum(["completed", "abandoned", "expired"]).default("completed"),
});
export type PykoAssessmentEnd = z.infer<typeof PykoAssessmentEnd>;

// Paraphrase-tolerant query normaliser. Delegates to the structured intent
// resolver in ./intent so we do not double-maintain stopword lists. Only
// genuine filler words (articles, pronouns, wh-words, politeness) are
// removed — real action verbs like "make", "give", "get", "use", "submit",
// "open" are KEPT so downstream matchers can tell "make homework" from
// "submit homework" from "grade homework".
import { tokenizePyko, resolveIntent, isCreateIntent } from "./intent";

export function normalizePykoQuery(message: string): string {
  return tokenizePyko(message).join(" ");
}

// All-Rounder classifier: fast, deterministic, heuristic-only (no extra
// model call — that would double budget cost). Order matters: pasted code
// first, then coach signals, then guide (topic + admin/navigation action),
// then tutor (concept explanation), fallback guide.
export function classifyAllRounder(
  message: string,
  code?: string,
): "guide" | "tutor" | "corrector" | "coach" {
  const hasFencedCode = /```/.test(message);
  const looksLikeCode = /\b(def |print\(|import |for |while |class |traceback|error:|syntaxerror|nameerror|typeerror|indexerror|indentationerror)\b/i.test(
    message,
  );
  if (code || hasFencedCode || looksLikeCode) return "corrector";

  const intent = resolveIntent(message);
  const t = intent.topic;

  // Coach: progress / streak / badge / rank reflection questions.
  const coachSignals = /\b(progress|improve|improving|next step|study plan|am i doing|how am i)\b/i.test(message);
  if (coachSignals) return "coach";
  if (
    (t === "streak" || t === "badge" || t === "leaderboard" || t === "analytics") &&
    (intent.action === "explain" || intent.action === "navigate" || intent.action === "unknown")
  ) {
    return "coach";
  }

  // Guide: any recognised website topic with a website-y action.
  const websiteActions: Array<typeof intent.action> = [
    "navigate", "open", "submit", "attempt", "grade", "return", "review",
    "create", "assign", "publish", "delete", "schedule",
  ];
  if (t && (websiteActions.includes(intent.action) || intent.action === "unknown")) {
    // Explicit navigation phrasing OR an admin/creation verb OR any known topic
    // without a Python-teaching keyword — treat as Guide.
    const looksLikePythonConcept = /\b(loop|list|dictionary|dict|tuple|set|function|recursion|variable|string|syntax|input\(|print\(|class )\b/i.test(message);
    if (!looksLikePythonConcept) return "guide";
  }

  // Tutor: Python teaching / concept questions.
  const tutorTerms = /\b(explain|concept|loop|list|dictionary|dict|tuple|set|function|recursion|python|syntax|variable|string|difference between|meaning of|what is|why does|why is)\b/i;
  if (tutorTerms.test(message)) return "tutor";

  // Default: safer to route to Guide than to teach an unrelated topic.
  return "guide";
}

// Re-export for callers that used to import from ./schemas only.
export { resolveIntent, isCreateIntent, tokenizePyko };
export type { GuideIntent, GuideTopic, GuideAction } from "./intent";


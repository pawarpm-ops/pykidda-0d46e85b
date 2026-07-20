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
    // Students may only request guide, tutor (AI Teacher), or allrounder.
    // `corrector` and `coach` are internal submodes chosen by the server-side
    // All-Rounder router. `teacher` (Teacher Copilot) is admin-only and lives
    // behind a separate server function, not this student endpoint.
    mode: PykoStudentMode,
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
  mode: PykoStudentMode,
  subMode: PykoSubMode.optional(),
  fallback: z.boolean().default(false),
  clarification: z.boolean().default(false),
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

// All-Rounder classifier with confidence. Deterministic, heuristic-only (no
// extra model call). Returns the chosen submode plus a confidence score in
// [0,1] and a short reason. Callers can use low confidence to ask a
// clarifying question instead of committing to a submode.
export type AllRounderClassification = {
  subMode: "guide" | "tutor" | "corrector" | "coach";
  confidence: number;
  reason: string;
};

export function classifyAllRounderDetailed(
  message: string,
  code?: string,
): AllRounderClassification {
  // Strong corrector evidence first — must be MORE than a single code-ish word.
  const hasFencedCode = /```/.test(message);
  const hasTraceback = /\btraceback\b|\bfile "\S+", line \d+/i.test(message);
  const hasPyException = /\b(syntaxerror|nameerror|typeerror|indexerror|indentationerror|attributeerror|keyerror|valueerror|zerodivisionerror|modulenotfounderror)\b/i.test(
    message,
  );
  const hasMultilineCode = message.split("\n").filter((l) => /^\s*(def |for |while |if |elif |else|class |import |print\(|return )/.test(l)).length >= 2;
  const explicitFixRequest = /\b(fix|debug|correct|whats wrong|what's wrong|why doesn'?t (this|my code) work|error in my code)\b/i.test(message);

  if (code && code.trim().length > 0) {
    return { subMode: "corrector", confidence: 0.98, reason: "explicit code field" };
  }
  if (hasTraceback || hasPyException) {
    return { subMode: "corrector", confidence: 0.95, reason: "traceback / python exception in message" };
  }
  if (hasFencedCode && (explicitFixRequest || hasMultilineCode)) {
    return { subMode: "corrector", confidence: 0.9, reason: "fenced code with fix request or multiline code" };
  }
  if (hasMultilineCode && explicitFixRequest) {
    return { subMode: "corrector", confidence: 0.85, reason: "multiline code with fix request" };
  }

  const intent = resolveIntent(message);
  const t = intent.topic;

  // Coach signals (progress / streak reflection).
  const coachSignals = /\b(progress|improve|improving|next step|study plan|am i doing|how am i)\b/i.test(message);
  if (coachSignals) return { subMode: "coach", confidence: 0.8, reason: "progress reflection keywords" };
  if (
    (t === "streak" || t === "badge" || t === "leaderboard" || t === "analytics") &&
    (intent.action === "explain" || intent.action === "navigate" || intent.action === "unknown")
  ) {
    return { subMode: "coach", confidence: 0.75, reason: `${t} explain/navigate intent` };
  }

  // Tutor: Python teaching / concept questions.
  const tutorTerms = /\b(loop|for loop|while loop|list|dictionary|dict|tuple|set|function|recursion|python|syntax|variable|string|class|import|module|difference between|meaning of|what is (a|an)?|why does|why is|how does .* work)\b/i;
  if (tutorTerms.test(message)) return { subMode: "tutor", confidence: 0.85, reason: "python concept keywords" };

  // Guide: any recognised website topic with a website-y action.
  const websiteActions: Array<typeof intent.action> = [
    "navigate", "open", "submit", "attempt", "grade", "return", "review",
    "create", "assign", "publish", "delete", "schedule",
  ];
  if (t && (websiteActions.includes(intent.action) || intent.action === "unknown")) {
    return { subMode: "guide", confidence: 0.8, reason: `${t} ${intent.action}` };
  }

  // Nothing strong matched — low confidence guide, so the router can ask.
  return { subMode: "guide", confidence: 0.35, reason: "no strong signal" };
}

// Backwards-compatible thin wrapper.
export function classifyAllRounder(
  message: string,
  code?: string,
): "guide" | "tutor" | "corrector" | "coach" {
  return classifyAllRounderDetailed(message, code).subMode;
}

// Re-export for callers that used to import from ./schemas only.
export { resolveIntent, isCreateIntent, tokenizePyko };
export type { GuideIntent, GuideTopic, GuideAction } from "./intent";


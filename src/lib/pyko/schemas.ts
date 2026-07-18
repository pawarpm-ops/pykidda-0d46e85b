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

// All-Rounder classifier: fast, deterministic, heuristic-only (no extra
// model call — that would double budget cost). Order matters: code detection
// first, then coach signals, then guide signals, then tutor.
export function classifyAllRounder(
  message: string,
  code?: string,
): "guide" | "tutor" | "corrector" | "coach" {
  const m = message.toLowerCase();
  const hasFencedCode = /```/.test(message);
  const looksLikeCode = /\b(def |print\(|import |for |while |class |traceback|error:|syntaxerror|nameerror|typeerror|indexerror|indentationerror)\b/i.test(
    message,
  );
  if (code || hasFencedCode || looksLikeCode) return "corrector";

  const coachTerms = ["streak", "badge", "leaderboard", "progress", "improve", "how am i doing", "next step", "study plan"];
  if (coachTerms.some((t) => m.includes(t))) return "coach";

  const guideTerms = ["where is", "where do i", "how do i open", "how do i find", "how do i create", "how do i assign", "how do i submit", "how does homework", "how does grading", "how do scheduled", "homework section", "practice section", "mock test section", "publish", "assign homework", "notifications page"];
  if (guideTerms.some((t) => m.includes(t))) return "guide";

  const tutorTerms = ["explain", "what is", "how does a", "difference between", "why does", "concept", "loop", "list", "dictionary", "function", "recursion", "class", "python"];
  if (tutorTerms.some((t) => m.includes(t))) return "tutor";

  // Default to guide — safer than teaching an unrelated topic.
  return "guide";
}


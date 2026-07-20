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

// Robust query normaliser used by every keyword matcher (Guide keywords,
// All-Rounder classifier, walkthrough lookup). Lowercases, strips punctuation,
// removes filler/stop words, and collapses whitespace so paraphrases like
// "How do I create the homework?" match the same intent as "create homework".
const PYKO_STOPWORDS = new Set([
  "a","an","the","this","that","these","those",
  "i","me","my","mine","we","our","you","your","us",
  "is","am","are","was","were","be","been","being",
  "do","does","did","doing","done",
  "to","of","for","on","in","at","by","with","from","into","about","as",
  "how","what","why","when","where","which","who","whom","whose",
  "can","could","should","would","will","shall","may","might","must",
  "please","kindly","hey","hi","hello","pyko",
  "and","or","but","if","then","so","because","just","also","actually",
  "some","any","get","make","need","want","use","using","tell","show","give",
  "plz","pls","thx","thanks",
]);

export function normalizePykoQuery(message: string): string {
  if (!message) return "";
  const cleaned = message
    .toLowerCase()
    .replace(/[`~!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = cleaned.split(" ").filter((t) => t && !PYKO_STOPWORDS.has(t));
  return tokens.join(" ");
}

// All-Rounder classifier: fast, deterministic, heuristic-only (no extra
// model call — that would double budget cost). Order matters: code detection
// first, then coach signals, then guide signals, then tutor.
export function classifyAllRounder(
  message: string,
  code?: string,
): "guide" | "tutor" | "corrector" | "coach" {
  const raw = message.toLowerCase();
  const m = normalizePykoQuery(message);
  const hasFencedCode = /```/.test(message);
  const looksLikeCode = /\b(def |print\(|import |for |while |class |traceback|error:|syntaxerror|nameerror|typeerror|indexerror|indentationerror)\b/i.test(
    message,
  );
  if (code || hasFencedCode || looksLikeCode) return "corrector";

  const coachTerms = ["streak", "badge", "leaderboard", "progress", "improve", "am doing", "next step", "study plan", "rank"];
  if (coachTerms.some((t) => m.includes(t))) return "coach";

  const guideTerms = [
    "create homework", "assign homework", "make homework", "publish homework", "new homework",
    "submit homework", "open homework", "view homework", "homework section", "homework page",
    "create practice", "add practice", "publish practice", "practice section", "practice page",
    "create mock", "schedule mock", "mock section", "mock page", "take mock", "scheduled mock",
    "notifications page", "notifications section",
    "where find", "where see", "where open", "open profile", "open admin",
    "grade homework", "grading", "return correction",
  ];
  if (guideTerms.some((t) => m.includes(t))) return "guide";

  const tutorTerms = ["explain", "concept", "loop", "list", "dictionary", "function", "recursion", "class python", "python", "difference between", "syntax", "variable", "string", "tuple", "set", "print", "input"];
  if (tutorTerms.some((t) => m.includes(t)) || /\b(what|why)\b/.test(raw)) return "tutor";

  // Default to guide — safer than teaching an unrelated topic.
  return "guide";
}


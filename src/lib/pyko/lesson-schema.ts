import { z } from "zod";

export const PykoLessonSectionSchema = z.object({
  type: z.enum([
    "explanation",
    "steps",
    "syntax",
    "example",
    "analogy",
    "mistakes",
    "tip",
  ]),
  title: z.string().min(1).max(120),
  content: z.string().max(2000).optional(),
  points: z.array(z.string().max(400)).max(12).optional(),
});

export const PykoCodeExampleSchema = z.object({
  title: z.string().min(1).max(120),
  code: z.string().max(4000),
  output: z.string().max(1500).optional(),
  explanation: z.string().max(1200).optional(),
});

export const PykoChallengeSchema = z.object({
  title: z.string().min(1).max(120),
  instruction: z.string().max(1200),
  hint: z.string().max(600).optional(),
  starterCode: z.string().max(2000).optional(),
});

export const PykoNextStepSchema = z.object({
  label: z.string().min(1).max(80),
  suggestedPrompt: z.string().min(1).max(240),
});

export const PykoLessonSchema = z.object({
  type: z.literal("lesson"),
  topic: z.string().min(1).max(120),
  title: z.string().min(1).max(140),
  summary: z.string().min(1).max(600),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  sections: z.array(PykoLessonSectionSchema).min(1).max(10),
  codeExamples: z.array(PykoCodeExampleSchema).max(4).optional(),
  challenge: PykoChallengeSchema.optional(),
  nextSteps: z.array(PykoNextStepSchema).max(4).optional(),
});

export type PykoLessonResponse = z.infer<typeof PykoLessonSchema>;

const FENCE_RE = /```pyko-lesson\s*\n([\s\S]*?)\n```/;

/**
 * Extract a pyko-lesson JSON block from a raw assistant message.
 * Returns { lesson, before, after } if present and valid, else null.
 */
export function extractPykoLesson(raw: string): {
  lesson: PykoLessonResponse;
  before: string;
  after: string;
} | null {
  if (!raw) return null;
  const m = raw.match(FENCE_RE);
  if (!m || m.index === undefined) return null;
  try {
    const parsed = JSON.parse(m[1]);
    const lesson = PykoLessonSchema.parse(parsed);
    return {
      lesson,
      before: raw.slice(0, m.index).trim(),
      after: raw.slice(m.index + m[0].length).trim(),
    };
  } catch {
    return null;
  }
}

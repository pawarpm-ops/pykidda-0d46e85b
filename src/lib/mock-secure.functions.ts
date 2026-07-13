// Server-side entry points for the built-in mock test runner. The browser
// only ever gets sanitized data through these fns — no expected outputs, no
// reference solutions, no correct answers. Grading is done here against the
// server-only test cases in `mock-questions.server.ts`.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  normalizeOutput,
  serverGetMockTest,
  serverMockQuestions,
} from "./mock-questions.server";

// -------- Sanitized fetch (student view) --------

// What the browser is allowed to know about a mock question. No `expected`,
// no reference solution, no correctness flags. Stdins are visible because
// grading executes in the browser via Pyodide (user-approved tradeoff).
export type SanitizedMockQuestion = {
  id: string;
  title: string;
  prompt: string;
  starterCode: string;
  marks: number;
  testStdins: string[];
  // Sample = first test case, shown to the student as an example.
  sample: { stdin: string; expected: string } | null;
};

export type SanitizedMockTest = {
  id: string;
  name: string;
  description: string;
  durationSec: number;
  totalMarks: number;
  questions: SanitizedMockQuestion[];
};

export const getStudentMockTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ testId: z.string().min(1).max(200) }).parse(d),
  )
  .handler(async ({ data }): Promise<SanitizedMockTest> => {
    const test = serverGetMockTest(data.testId);
    if (!test) throw new Error("Mock test not found");
    const qs = serverMockQuestions(test);
    const questions: SanitizedMockQuestion[] = qs.map((q) => ({
      id: q.id,
      title: q.title,
      prompt: q.prompt,
      starterCode: q.starterCode,
      marks: q.marks,
      testStdins: q.tests.map((t) => t.stdin),
      sample: q.tests[0]
        ? { stdin: q.tests[0].stdin, expected: q.tests[0].expected }
        : null,
    }));
    return {
      id: test.id,
      name: test.name,
      description: test.description,
      durationSec: test.durationSec,
      totalMarks: qs.reduce((s, q) => s + q.marks, 0),
      questions,
    };
  });

// -------- Server-side graded submit --------

const AttemptSchema = z.object({
  testId: z.string().min(1).max(200),
  timeTakenSec: z.number().int().min(0).max(24 * 60 * 60),
  submissionType: z.enum(["normal", "auto-violation"]),
  violationReason: z.string().max(500).nullable().optional(),
  submittedAt: z.number().int(),
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1).max(200),
        code: z.string().max(200_000),
        // One entry per server-provided stdin, IN ORDER. If missing or short
        // the server treats absent entries as failures. Extra entries ignored.
        runs: z
          .array(
            z.object({
              stdin: z.string().max(200_000),
              stdout: z.string().max(200_000),
              stderr: z.string().max(200_000).optional().default(""),
              ok: z.boolean(),
            }),
          )
          .max(50),
      }),
    )
    .max(50),
});

export type GradedRunResult = {
  passed: boolean;
  // We intentionally do NOT return `expected` to the client.
  actual: string;
  stderr: string;
};

export type GradedQuestion = {
  questionId: string;
  passed: number;
  total: number;
  marksObtained: number;
  marksTotal: number;
  results: GradedRunResult[];
};

export type GradedAttempt = {
  attemptId: string;
  marksObtained: number;
  totalMarks: number;
  percentage: number;
  grade: string;
  totalQuestions: number;
  timeTakenSec: number;
  submissionType: "normal" | "auto-violation";
  violationReason: string | null;
  submittedAt: string;
  perQuestion: GradedQuestion[];
};

function gradeFor(pct: number): string {
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B";
  if (pct >= 60) return "C";
  if (pct >= 50) return "D";
  return "F";
}

export const submitGradedMockAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AttemptSchema.parse(d))
  .handler(async ({ data, context }): Promise<GradedAttempt> => {
    const test = serverGetMockTest(data.testId);
    if (!test) throw new Error("Mock test not found");
    const qs = serverMockQuestions(test);

    const perQuestion: GradedQuestion[] = [];
    let marksObtained = 0;
    let totalMarks = 0;

    for (const q of qs) {
      totalMarks += q.marks;
      const submitted = data.answers.find((a) => a.questionId === q.id);
      const results: GradedRunResult[] = [];
      let passed = 0;
      for (let i = 0; i < q.tests.length; i++) {
        const tc = q.tests[i];
        const run = submitted?.runs[i];
        // Bind the run to the correct test case by stdin match — clients
        // could otherwise misalign runs and cheat. If mismatch, that test
        // fails.
        const validRun =
          run &&
          run.ok &&
          normalizeOutput(run.stdin) === normalizeOutput(tc.stdin);
        const actual = validRun ? normalizeOutput(run!.stdout) : "";
        const stderr = run ? normalizeOutput(run.stderr ?? "") : "";
        const ok = validRun && actual === normalizeOutput(tc.expected);
        if (ok) passed++;
        results.push({ passed: ok, actual, stderr });
      }
      const allPassed = passed === q.tests.length && q.tests.length > 0;
      const marks = allPassed ? q.marks : 0;
      marksObtained += marks;
      perQuestion.push({
        questionId: q.id,
        passed,
        total: q.tests.length,
        marksObtained: marks,
        marksTotal: q.marks,
        results,
      });
    }

    const percentage =
      totalMarks > 0 ? Math.round((marksObtained / totalMarks) * 100) : 0;
    const grade = gradeFor(percentage);
    const submittedAt = new Date(data.submittedAt).toISOString();

    // Persist the graded result. Details include per-question breakdown but
    // NOT expected outputs (they never leave the server).
    const detailsForStorage = {
      attempts: perQuestion.map((pq, i) => {
        const submitted = data.answers.find((a) => a.questionId === pq.questionId);
        return {
          questionId: pq.questionId,
          code: submitted?.code ?? "",
          passed: pq.passed,
          total: pq.total,
          marksObtained: pq.marksObtained,
          marksTotal: pq.marksTotal,
          results: pq.results.map((r) => ({
            passed: r.passed,
            // stored `expected` = empty; client should not receive it either
            expected: "",
            actual: r.actual,
            stderr: r.stderr,
          })),
        };
      }),
    };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inserted, error } = await supabaseAdmin
      .from("mock_results")
      .insert({
        user_id: context.userId,
        test_id: test.id,
        test_name: test.name,
        student_name: (context.claims?.email as string | undefined) ?? "Student",
        marks_obtained: marksObtained,
        total_marks: totalMarks,
        percentage,
        grade,
        total_questions: qs.length,
        time_taken_sec: data.timeTakenSec,
        submission_type: data.submissionType,
        violation_reason: data.violationReason ?? null,
        submitted_at: submittedAt,
        details: detailsForStorage,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    return {
      attemptId: inserted.id,
      marksObtained,
      totalMarks,
      percentage,
      grade,
      totalQuestions: qs.length,
      timeTakenSec: data.timeTakenSec,
      submissionType: data.submissionType,
      violationReason: data.violationReason ?? null,
      submittedAt,
      perQuestion,
    };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  testId: z.string().min(1).max(200),
  testName: z.string().min(1).max(300),
  studentName: z.string().min(1).max(200),
  marksObtained: z.number().finite().min(0).max(100000),
  totalMarks: z.number().finite().min(1).max(100000),
  totalQuestions: z.number().int().min(0).max(10000),
  timeTakenSec: z.number().int().min(0).max(24 * 60 * 60),
  submissionType: z.enum(["normal", "auto-violation"]),
  violationReason: z.string().max(500).nullable().optional(),
  submittedAt: z.number().int(),
});

function gradeFor(pct: number): string {
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B";
  if (pct >= 60) return "C";
  if (pct >= 50) return "D";
  return "F";
}

export const submitMockResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    // Reject fabricated scores: recompute percentage + grade server-side
    // from the marks/total pair, and reject impossible combinations. The
    // legacy static-mock UI only proves the student pressed submit; treat
    // marksObtained as untrusted-but-bounded, and derive percentage/grade
    // from it so the leaderboard can't be inflated by a hand-crafted RPC
    // call with percentage: 100.
    if (data.marksObtained > data.totalMarks) {
      throw new Error("marksObtained cannot exceed totalMarks");
    }
    const percentage = Math.round((data.marksObtained / data.totalMarks) * 100);
    const grade = gradeFor(percentage);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("mock_results").insert({
      user_id: context.userId,
      test_id: data.testId,
      test_name: data.testName,
      student_name: data.studentName,
      marks_obtained: data.marksObtained,
      total_marks: data.totalMarks,
      percentage,
      grade,
      total_questions: data.totalQuestions,
      time_taken_sec: data.timeTakenSec,
      submission_type: data.submissionType,
      violation_reason: data.violationReason ?? null,
      submitted_at: new Date(data.submittedAt).toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

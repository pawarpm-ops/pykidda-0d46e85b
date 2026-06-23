import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  testId: z.string().min(1).max(200),
  testName: z.string().min(1).max(300),
  studentName: z.string().min(1).max(200),
  marksObtained: z.number().finite().min(0).max(100000),
  totalMarks: z.number().finite().min(0).max(100000),
  percentage: z.number().finite().min(0).max(100),
  grade: z.string().min(1).max(10),
  totalQuestions: z.number().int().min(0).max(10000),
  timeTakenSec: z.number().int().min(0).max(24 * 60 * 60),
  submissionType: z.enum(["normal", "auto-violation"]),
  violationReason: z.string().max(500).nullable().optional(),
  submittedAt: z.number().int(),
});

export const submitMockResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("mock_results").insert({
      user_id: context.userId,
      test_id: data.testId,
      test_name: data.testName,
      student_name: data.studentName,
      marks_obtained: data.marksObtained,
      total_marks: data.totalMarks,
      percentage: data.percentage,
      grade: data.grade,
      total_questions: data.totalQuestions,
      time_taken_sec: data.timeTakenSec,
      submission_type: data.submissionType,
      violation_reason: data.violationReason ?? null,
      submitted_at: new Date(data.submittedAt).toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

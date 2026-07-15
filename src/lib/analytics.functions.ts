import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyAnalyticsData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [practiceRes, mockRes] = await Promise.all([
      supabaseAdmin
        .from("practice_attempts")
        .select("question_id,unit,passed,total,solved,attempted_at")
        .eq("user_id", context.userId)
        .order("attempted_at", { ascending: false })
        .limit(1000),
      supabaseAdmin
        .from("mock_results")
        .select(
          "test_id,test_name,percentage,grade,marks_obtained,total_marks,total_questions,time_taken_sec,submission_type,violation_reason,submitted_at",
        )
        .eq("user_id", context.userId)
        .order("submitted_at", { ascending: false })
        .limit(500),
    ]);

    if (practiceRes.error) throw new Error(practiceRes.error.message);
    if (mockRes.error) throw new Error(mockRes.error.message);

    return {
      practice: (practiceRes.data ?? []).map((p) => ({
        questionId: p.question_id as string,
        unit: Number(p.unit ?? 0),
        passed: Number(p.passed ?? 0),
        total: Number(p.total ?? 0),
        solved: Boolean(p.solved),
        at: p.attempted_at ? new Date(p.attempted_at as string).getTime() : Date.now(),
      })),
      mocks: (mockRes.data ?? []).map((m) => ({
        testId: m.test_id as string,
        testName: (m.test_name as string) ?? "Mock test",
        percentage: Number(m.percentage ?? 0),
        grade: (m.grade as string) ?? "",
        marksObtained: Number(m.marks_obtained ?? 0),
        totalMarks: Number(m.total_marks ?? 0),
        totalQuestions: Number(m.total_questions ?? 0),
        timeTakenSec: Number(m.time_taken_sec ?? 0),
        submissionType: ((m.submission_type as string) === "auto-violation"
          ? "auto-violation"
          : "normal") as "normal" | "auto-violation",
        violationReason: (m.violation_reason as string | null) ?? undefined,
        at: m.submitted_at ? new Date(m.submitted_at as string).getTime() : Date.now(),
      })),
    };
  });

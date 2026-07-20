import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyAnalyticsData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Practice attempts are not persisted (practice is for self-learning
    // only), so analytics only surface mock test history.
    const mockRes = await supabaseAdmin
      .from("mock_results")
      .select(
        "test_id,test_name,percentage,grade,marks_obtained,total_marks,total_questions,time_taken_sec,submission_type,violation_reason,submitted_at",
      )
      .eq("user_id", context.userId)
      .order("submitted_at", { ascending: false })
      .limit(500);

    if (mockRes.error) throw new Error(mockRes.error.message);

    return {
      practice: [] as Array<{
        questionId: string;
        unit: number;
        passed: number;
        total: number;
        solved: boolean;
        at: number;
      }>,
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

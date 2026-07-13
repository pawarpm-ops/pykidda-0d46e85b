import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { QUESTIONS } from "./questions";

const InputSchema = z.object({
  questionId: z.string().min(1).max(200),
  unit: z.number().int().min(0).max(1000),
  passed: z.number().int().min(0).max(10000),
  total: z.number().int().min(0).max(10000),
  solved: z.boolean(),
});

export const submitPracticeAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    // Server-side sanity checks — reject fabricated scores. The actual
    // Python execution happens in-browser (Pyodide) so we cannot re-verify
    // the code here, but we DO enforce that the counters submitted are
    // internally consistent with the question's real test-case count.
    const q = QUESTIONS.find((x) => x.id === data.questionId);
    if (!q) throw new Error("Unknown question");
    if (data.unit !== q.unit) throw new Error("Unit mismatch");
    if (data.total !== q.tests.length) throw new Error("Invalid total");
    if (data.passed > data.total) throw new Error("Invalid pass count");
    if (data.solved !== (data.passed === data.total && data.total > 0)) {
      throw new Error("Inconsistent solved flag");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("practice_attempts").insert({
      user_id: context.userId,
      question_id: data.questionId,
      unit: data.unit,
      passed: data.passed,
      total: data.total,
      solved: data.solved,
    });
    if (error) throw new Error(error.message);

    // Record streak activity when the student actually solves the question.
    // Uses the authenticated user client so the RPC runs as the student
    // (the SECURITY DEFINER function uses auth.uid()).
    if (data.solved) {
      try {
        await context.supabase.rpc("record_streak_activity", {
          _activity_type: "practice_question_solved",
          _reference_id: data.questionId,
        });
      } catch (e) {
        console.error("[submitPracticeAttempt] streak record failed", e);
      }
    }

    return { ok: true };
  });


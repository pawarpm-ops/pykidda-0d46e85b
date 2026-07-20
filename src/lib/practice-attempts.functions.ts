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

// Practice attempts are intentionally NOT persisted — practice is for
// self-learning only. We still validate the submission for internal
// consistency and record a streak activity when the student solves a
// question, but no per-attempt row is stored anywhere.
export const submitPracticeAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    let expectedUnit: number;
    let expectedTotal: number;

    if (data.questionId.startsWith("db-")) {
      const uuid = data.questionId.slice(3);
      const { data: row, error } = await context.supabase
        .from("practice_questions")
        .select("unit, tests, status")
        .eq("id", uuid)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!row || row.status !== "published") throw new Error("Unknown question");
      expectedUnit = row.unit as number;
      expectedTotal = Array.isArray(row.tests) ? (row.tests as unknown[]).length : 0;
    } else {
      const q = QUESTIONS.find((x) => x.id === data.questionId);
      if (!q) throw new Error("Unknown question");
      expectedUnit = q.unit;
      expectedTotal = q.tests.length;
    }

    if (data.unit !== expectedUnit) throw new Error("Unit mismatch");
    if (data.total !== expectedTotal) throw new Error("Invalid total");
    if (data.passed > data.total) throw new Error("Invalid pass count");
    if (data.solved !== (data.passed === data.total && data.total > 0)) {
      throw new Error("Inconsistent solved flag");
    }

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

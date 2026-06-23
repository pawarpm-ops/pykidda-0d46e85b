import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
    return { ok: true };
  });

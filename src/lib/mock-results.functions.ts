import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// NOTE: The legacy `submitMockResult` server function was removed because it
// trusted client-supplied marks/percentage/grade values and allowed a caller
// to fabricate perfect scores by invoking the RPC directly. All mock-test
// submissions now go through `submitGradedMockAttempt` in
// `mock-secure.functions.ts`, which recomputes marks server-side against the
// server-only test cases in `mock-questions.server.ts`.


export const listMyMockResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ test_id: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("mock_results")
      .select("id,submitted_at,marks_obtained,total_marks,percentage,grade,total_questions,time_taken_sec,submission_type,violation_reason,details")
      .eq("test_id", data.test_id)
      .eq("user_id", context.userId)
      .order("submitted_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getMyMockResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ attempt_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("mock_results")
      .select("id,test_id,test_name,student_name,submitted_at,marks_obtained,total_marks,percentage,grade,total_questions,time_taken_sec,submission_type,violation_reason,details")
      .eq("id", data.attempt_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Attempt not found");
    return row;
  });

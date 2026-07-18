// Pyko assessment lifecycle — students start a session when they open a
// mock/AI/scheduled test's take screen, and end it on submit or exit. While
// a session is active, the Pyko gateway refuses to answer.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PykoAssessmentStart, PykoAssessmentEnd } from "./schemas";

export const startPykoAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PykoAssessmentStart.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true; id: string }> => {
    const { supabase } = context;
    const { data: id, error } = await supabase.rpc("pyko_start_assessment", {
      _assessment_id: data.assessmentId,
      _type: data.type,
      _duration_minutes: data.durationMinutes,
    });
    if (error) throw new Error(error.message);
    return { ok: true, id: (id as unknown as string) ?? "" };
  });

export const endPykoAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PykoAssessmentEnd.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase } = context;
    const { error } = await supabase.rpc("pyko_end_assessment", {
      _assessment_id: data.assessmentId,
      _reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

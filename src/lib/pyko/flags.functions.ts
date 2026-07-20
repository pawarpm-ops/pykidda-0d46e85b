// Read-only helper exposing which student-selectable Pyko modes are enabled.
// Used by the floating panel to grey-out disabled modes in the selector.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PykoEnabledModes = {
  master: boolean;
  guide: boolean;
  tutor: boolean;
  allrounder: boolean;
};

export const getPykoEnabledModes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PykoEnabledModes> => {
    const { data } = await context.supabase
      .from("pyko_feature_flags")
      .select("key, enabled")
      .in("key", [
        "pyko_ai_enabled",
        "pyko_mode_guide",
        "pyko_mode_tutor",
        "pyko_mode_allrounder",
      ]);
    const map = new Map((data ?? []).map((r) => [r.key as string, !!r.enabled]));
    return {
      master: map.get("pyko_ai_enabled") ?? false,
      guide: map.get("pyko_mode_guide") ?? false,
      tutor: map.get("pyko_mode_tutor") ?? false,
      allrounder: map.get("pyko_mode_allrounder") ?? false,
    };
  });

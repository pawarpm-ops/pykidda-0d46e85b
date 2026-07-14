import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";

function supa(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "get_my_streak",
  title: "Get my streak",
  description:
    "Return the signed-in student's daily practice streak: current streak, longest, last activity date, freezes available, and whether today is completed.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const { data, error } = await supa(ctx)
      .from("student_streaks")
      .select(
        "current_streak, longest_streak, last_activity_date, today_completed, streak_freezes_available, streak_freezes_used, updated_at",
      )
      .eq("user_id", ctx.getUserId())
      .maybeSingle();
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? { current_streak: 0, longest_streak: 0 }) }],
      structuredContent: { streak: data },
    };
  },
});

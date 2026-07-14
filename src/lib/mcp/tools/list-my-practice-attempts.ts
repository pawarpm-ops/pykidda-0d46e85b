import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supa(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_my_practice_attempts",
  title: "List my practice attempts",
  description: "Return the signed-in student's recent Python practice attempts, newest first.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).optional().describe("Max rows to return (1-100, default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const { data, error } = await supa(ctx)
      .from("practice_attempts")
      .select("id, question_id, unit, passed, total, solved, attempted_at")
      .eq("user_id", ctx.getUserId())
      .order("attempted_at", { ascending: false })
      .limit(limit ?? 20);
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { attempts: data ?? [] },
    };
  },
});

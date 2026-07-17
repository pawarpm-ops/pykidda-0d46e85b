// Pyko AI — central gateway server function.
// Every future Pyko mode routes through this single entrypoint so we can
// enforce auth, feature flags, assessment lockout, and budgets in one place.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { PykoChatInput, type PykoChatOutput } from "./schemas";
import { createPykoProvider, PYKO_DEFAULT_MODEL } from "./provider.server";
import { GLOBAL_POLICY, MODE_PROMPTS, PROMPT_VERSION } from "./prompts";
import {
  assertPykoEnabled,
  assertNotInActiveAssessment,
  enforceAndIncrementBudget,
  PykoPolicyError,
} from "./policy.server";

function newTraceId(): string {
  return `pyko_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

async function logTelemetry(
  admin: import("@supabase/supabase-js").SupabaseClient,
  row: {
    userId: string | null;
    traceId: string;
    mode: string;
    provider: string;
    model: string;
    latencyMs: number;
    responseStatus: string;
    errorMessage?: string;
  },
) {
  try {
    await admin.from("pyko_telemetry").insert({
      user_id: row.userId,
      trace_id: row.traceId,
      mode: row.mode,
      prompt_version: PROMPT_VERSION,
      provider: row.provider,
      model: row.model,
      latency_ms: row.latencyMs,
      response_status: row.responseStatus,
      error_message: row.errorMessage ?? null,
    });
  } catch {
    // Telemetry failures must never break the user response.
  }
}

export const pykoChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PykoChatInput.parse(d))
  .handler(async ({ data, context }): Promise<PykoChatOutput> => {
    const { supabase, userId } = context;
    const traceId = newTraceId();
    const started = Date.now();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    try {
      // 1. Policy: flag → assessment lockout → budget. Order matters.
      await assertPykoEnabled(supabase, data.mode);
      await assertNotInActiveAssessment(supabase, userId, data.mode);
      await enforceAndIncrementBudget(supabaseAdmin, userId);

      // 2. Get or create conversation (RLS-scoped to this user).
      let conversationId = data.conversationId;
      if (!conversationId) {
        const { data: conv, error } = await supabase
          .from("pyko_conversations")
          .insert({
            user_id: userId,
            mode: data.mode,
            page_context: data.pageContext ?? {},
            title: data.message.slice(0, 80),
          })
          .select("id")
          .single();
        if (error || !conv) throw new PykoPolicyError("conv_create_failed", "Couldn't start a Pyko conversation.", 500);
        conversationId = conv.id as string;
      }

      // 3. Persist the user message.
      await supabase.from("pyko_messages").insert({
        conversation_id: conversationId,
        user_id: userId,
        role: "user",
        content: data.message,
        mode: data.mode,
        prompt_version: PROMPT_VERSION,
      });

      // 4. Load recent history for this conversation (bounded).
      const { data: history } = await supabase
        .from("pyko_messages")
        .select("role, content")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(20);

      // 5. Call the model.
      const gateway = createPykoProvider();
      const model = gateway(PYKO_DEFAULT_MODEL);
      const systemPrompt = `${GLOBAL_POLICY}\n\n${MODE_PROMPTS[data.mode]}`;

      const messages: Array<{ role: "user" | "assistant"; content: string }> = (
        (history ?? []) as Array<{ role: string; content: string }>
      )
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      const result = await generateText({
        model,
        system: systemPrompt,
        messages,
        providerOptions: { lovable: { reasoningEffort: "none" } },
      });

      const content = result.text?.trim() || "Sorry, I couldn't generate a response. Please try again.";
      const latency = Date.now() - started;

      // 6. Persist assistant message.
      const { data: msgRow, error: msgErr } = await supabase
        .from("pyko_messages")
        .insert({
          conversation_id: conversationId,
          user_id: userId,
          role: "assistant",
          content,
          mode: data.mode,
          prompt_version: PROMPT_VERSION,
          model: PYKO_DEFAULT_MODEL,
          latency_ms: latency,
        })
        .select("id")
        .single();
      if (msgErr || !msgRow) throw new PykoPolicyError("msg_write_failed", "Pyko responded but we couldn't save it.", 500);

      await logTelemetry(supabaseAdmin, {
        userId,
        traceId,
        mode: data.mode,
        provider: "lovable",
        model: PYKO_DEFAULT_MODEL,
        latencyMs: latency,
        responseStatus: "ok",
      });

      return {
        conversationId,
        messageId: msgRow.id as string,
        traceId,
        content,
        mode: data.mode,
        fallback: false,
      };
    } catch (err) {
      const latency = Date.now() - started;
      const message = err instanceof Error ? err.message : String(err);
      const status = err instanceof PykoPolicyError ? err.code : "error";
      await logTelemetry(supabaseAdmin, {
        userId,
        traceId,
        mode: data.mode,
        provider: "lovable",
        model: PYKO_DEFAULT_MODEL,
        latencyMs: latency,
        responseStatus: status,
        errorMessage: message.slice(0, 500),
      });
      throw err;
    }
  });

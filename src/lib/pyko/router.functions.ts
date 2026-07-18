// Pyko AI — central gateway server function.
// Every future Pyko mode routes through this single entrypoint so we can
// enforce auth, feature flags, assessment lockout, and budgets in one place.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { PykoChatInput, type PykoChatOutput } from "./schemas";
import { createPykoProvider, PYKO_DEFAULT_MODEL } from "./provider.server";
import { buildSystemPrompt, PROMPT_VERSION } from "./prompts";
import { guideFallback } from "./knowledge.server";
import {
  assertPykoEnabled,
  assertNotInActiveAssessment,
  assertModeAllowedForUser,
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
    // Metadata only — never content, prompt text, or page-context payloads.
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
      // 1. Policy: flag → assessment lockout → role/mode → budget. Order matters.
      await assertPykoEnabled(supabase, data.mode);
      await assertNotInActiveAssessment(supabase, userId);
      await assertModeAllowedForUser(supabase, userId, data.mode);
      await enforceAndIncrementBudget(supabaseAdmin, userId);

      // 2. Get or create conversation (RLS-scoped to this user).
      let conversationId = data.conversationId;
      if (conversationId) {
        // Ownership check — RLS would filter to own rows, but be explicit
        // so a cross-user id fails loudly with a policy error, not silently.
        const { data: owned, error: ownErr } = await supabase
          .from("pyko_conversations")
          .select("id, mode")
          .eq("id", conversationId)
          .maybeSingle();
        if (ownErr) throw new PykoPolicyError("conv_lookup_failed", "Pyko can't load this conversation.", 500);
        if (!owned) throw new PykoPolicyError("conv_forbidden", "This conversation doesn't belong to you.", 403);
        if (owned.mode !== data.mode) {
          throw new PykoPolicyError("mode_mismatch", "This conversation uses a different Pyko mode.", 400);
        }
      } else {
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

      // 3. Persist the user message (skip on retry to avoid duplicates).
      if (!data.retry) {
        const { error: userMsgErr } = await supabase.from("pyko_messages").insert({
          conversation_id: conversationId,
          user_id: userId,
          role: "user",
          content: data.message,
          mode: data.mode,
          prompt_version: PROMPT_VERSION,
        });
        if (userMsgErr) throw new PykoPolicyError("msg_write_failed", "Couldn't save your message.", 500);
      }

      // 4. Load the most recent 20 messages in chronological order.
      const { data: recent, error: histErr } = await supabase
        .from("pyko_messages")
        .select("role, content")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (histErr) throw new PykoPolicyError("history_read_failed", "Pyko can't load the conversation.", 500);
      const history = ((recent ?? []) as Array<{ role: string; content: string }>)
        .filter((m) => m.role === "user" || m.role === "assistant")
        .reverse();

      // 5. Resolve sub-mode. For All-Rounder we heuristically classify the
      // request into guide/tutor/corrector/coach so we can pick the right
      // system prompt and label the response.
      const currentRoute = data.pageContext?.route;
      const subMode = data.mode === "allrounder"
        ? classifyAllRounder(data.message, data.code)
        : undefined;
      const effectiveMode = subMode ?? data.mode;

      // If user pasted code, append it as a fenced block to the last user
      // message so the model sees it. We never accept hidden tests or
      // reference solutions — the schema rejects unknown keys.
      const messages: Array<{ role: "user" | "assistant"; content: string }> = history.map(
        (m) => ({ role: m.role as "user" | "assistant", content: m.content }),
      );
      if (data.code && messages.length > 0) {
        const last = messages[messages.length - 1];
        if (last.role === "user") {
          last.content = `${last.content}\n\n\`\`\`python\n${data.code.slice(0, 8000)}\n\`\`\``;
        }
      }

      // 6. Call the model.
      const gateway = createPykoProvider();
      const model = gateway(PYKO_DEFAULT_MODEL);
      const systemPrompt = buildSystemPrompt(
        effectiveMode as "guide" | "tutor" | "corrector" | "coach" | "teacher" | "allrounder",
        currentRoute,
        data.message,
      );

      let content = "";
      let providerFailed = false;
      try {
        const result = await generateText({
          model,
          system: systemPrompt,
          messages,
          abortSignal: AbortSignal.timeout(25_000),
          providerOptions: { lovable: { reasoningEffort: "none" } },
        });
        content = (result.text ?? "").trim();
      } catch (e) {
        providerFailed = true;
        content = "";
        if (effectiveMode !== "guide") throw e;
      }

      if (!content) {
        content =
          effectiveMode === "guide"
            ? guideFallback(data.message)
            : "Sorry, I couldn't generate a response. Please try again.";
      }
      const latency = Date.now() - started;

      // 7. Persist assistant message via RLS-scoped client (owner insert).
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
        responseStatus: providerFailed ? "fallback" : "ok",
      });

      return {
        conversationId,
        messageId: msgRow.id as string,
        traceId,
        content,
        mode: data.mode,
        subMode,
        fallback: providerFailed,
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

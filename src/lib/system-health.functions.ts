// Client-callable server functions for the System Health dashboard.
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };

const CategoryEnum = z.enum([
  "ai",
  "pdf",
  "login",
  "api",
  "performance",
  "pyodide",
]);
const SeverityEnum = z.enum(["low", "medium", "high", "critical"]);
const StatusEnum = z.enum(["new", "reviewed", "resolved"]);

// ---------- logging (any signed-in user OR anon for login/pyodide) ----------

const LogInput = z.object({
  category: CategoryEnum,
  errorMessage: z.string().min(1).max(4000),
  moduleName: z.string().max(120).nullable().optional(),
  pageRoute: z.string().max(400).nullable().optional(),
  severity: SeverityEnum.optional(),
  statusCode: z.number().int().nullable().optional(),
  errorDetails: z.record(z.string(), z.any()).nullable().optional(),
  deviceInfo: z.record(z.string(), z.any()).nullable().optional(),
  durationMs: z.number().int().nullable().optional(),
  userEmail: z.string().max(320).nullable().optional(),
});

/**
 * Client-side health-event logger. Anon-friendly (for login / pyodide crashes
 * before a session exists). Uses a server publishable client when unauth.
 */
export const logSystemHealthEvent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => LogInput.parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supa = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      {
        auth: {
          storage: undefined,
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );
    try {
      const { data: id, error } = await supa.rpc("log_system_health_event", {
        _category: data.category,
        _error_message: data.errorMessage.slice(0, 4000),
        _module_name: data.moduleName ?? null,
        _page_route: data.pageRoute ?? null,
        _severity: data.severity ?? "medium",
        _status_code: data.statusCode ?? null,
        _error_details: data.errorDetails ?? null,
        _device_info: data.deviceInfo ?? null,
        _duration_ms: data.durationMs ?? null,
        _user_email: data.userEmail ?? null,
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true, id };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

// ---------- admin-only reads ----------

async function assertAdmin(ctx: Ctx) {
  const { data } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Forbidden");
}

export type HealthLogRow = {
  id: string;
  category: string;
  module_name: string | null;
  page_route: string | null;
  user_id: string | null;
  user_email: string | null;
  error_message: string;
  error_details: any;
  status_code: number | null;
  severity: string;
  status: string;
  device_info: any;
  duration_ms: number | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
};

const ListInput = z.object({
  from: z.string().nullable().optional(),
  to: z.string().nullable().optional(),
  category: CategoryEnum.nullable().optional(),
  severity: SeverityEnum.nullable().optional(),
  status: StatusEnum.nullable().optional(),
  userEmail: z.string().nullable().optional(),
  moduleName: z.string().nullable().optional(),
  search: z.string().max(200).nullable().optional(),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
});

export const listHealthLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await assertAdmin(ctx);
    let q = ctx.supabase
      .from("system_health_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    if (data.category) q = q.eq("category", data.category);
    if (data.severity) q = q.eq("severity", data.severity);
    if (data.status) q = q.eq("status", data.status);
    if (data.userEmail) q = q.ilike("user_email", `%${data.userEmail}%`);
    if (data.moduleName) q = q.ilike("module_name", `%${data.moduleName}%`);
    if (data.search) {
      const s = data.search.replace(/[%_]/g, (m) => `\\${m}`);
      q = q.or(
        [
          `error_message.ilike.%${s}%`,
          `module_name.ilike.%${s}%`,
          `page_route.ilike.%${s}%`,
          `user_email.ilike.%${s}%`,
        ].join(","),
      );
    }
    q = q.range(data.offset, data.offset + data.limit - 1);
    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);
    return { rows: (rows ?? []) as HealthLogRow[], total: count ?? 0 };
  });

export const getHealthSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    await assertAdmin(ctx);
    const { data, error } = await ctx.supabase.rpc("system_health_summary");
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      category: string;
      count_today: number;
      count_7d: number;
      critical_today: number;
    }>;
  });

const UpdateStatusInput = z.object({
  id: z.string().uuid(),
  status: StatusEnum,
});

export const updateHealthLogStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateStatusInput.parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await assertAdmin(ctx);
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { status: data.status };
    if (data.status === "reviewed") {
      patch.reviewed_at = now;
      patch.reviewed_by = ctx.userId;
    } else if (data.status === "resolved") {
      patch.resolved_at = now;
      patch.resolved_by = ctx.userId;
      patch.reviewed_at = now;
      patch.reviewed_by = ctx.userId;
    }
    const { error } = await ctx.supabase
      .from("system_health_logs")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteHealthLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await assertAdmin(ctx);
    const { error } = await ctx.supabase
      .from("system_health_logs")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

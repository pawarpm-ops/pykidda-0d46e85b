// Client-callable audit-log server functions.
//
// - `logAdminAction`  — write a log entry from a client-side admin action
//                       (announcements, notifications, roll numbers, PDF
//                       downloads, settings toggles).
// - `listAuditLogs`   — admin sees all, others see only their own.
// - `getAuditLogSummary` — counts for today's summary cards.
// - `listAuditActors` — distinct actor list for the filter dropdown.

/* eslint-disable @typescript-eslint/no-explicit-any */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  captureRequestContext,
  type AuditModule,
} from "@/lib/audit-log.server";

type Ctx = { supabase: any; userId: string };

const ModuleEnum = z.enum([
  "homework",
  "mock_test",
  "assignment",
  "announcement",
  "notification",
  "student",
  "marks",
  "report",
  "settings",
  "ai",
]);

const LogInput = z.object({
  actionType: z.string().min(1).max(80),
  description: z.string().min(1).max(1000),
  moduleName: ModuleEnum,
  targetId: z.string().max(200).nullable().optional(),
  targetTitle: z.string().max(500).nullable().optional(),
  relatedStudentId: z.string().uuid().nullable().optional(),
  oldValue: z.any().nullable().optional(),
  newValue: z.any().nullable().optional(),
  metadata: z.record(z.string(), z.any()).nullable().optional(),
  status: z.enum(["success", "failed"]).optional(),
});

async function isAdmin(context: Ctx): Promise<boolean> {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  return Boolean(data);
}

async function assertAdminOrTeacher(context: Ctx) {
  // Any authenticated user with the admin OR the default 'student' role may not
  // write audit logs. Only teachers/admins should call this. We treat "not
  // student" as teacher/admin; students should never trigger these code paths.
  const { data: rows, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  if (error) throw new Error(error.message);
  const roles = (rows ?? []).map((r: { role: string }) => r.role);
  if (roles.includes("admin") || roles.includes("teacher")) return;
  throw new Error("Forbidden");
}

export const logAdminAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => LogInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdminOrTeacher(context as Ctx);
    const meta = {
      ...captureRequestContext(),
      ...(data.metadata ?? {}),
    };
    const { data: id, error } = await (context as Ctx).supabase.rpc(
      "log_admin_activity",
      {
        _action_type: data.actionType,
        _action_description: data.description,
        _module_name: data.moduleName,
        _target_id: data.targetId ?? null,
        _target_title: data.targetTitle ?? null,
        _related_student_id: data.relatedStudentId ?? null,
        _old_value: data.oldValue ?? null,
        _new_value: data.newValue ?? null,
        _metadata: meta,
        _status: data.status ?? "success",
      },
    );
    if (error) throw new Error(error.message);
    return { id };
  });

const ListInput = z.object({
  from: z.string().nullable().optional(), // ISO date/timestamp
  to: z.string().nullable().optional(),
  actorId: z.string().uuid().nullable().optional(),
  module: ModuleEnum.nullable().optional(),
  actionType: z.string().max(80).nullable().optional(),
  studentId: z.string().uuid().nullable().optional(),
  search: z.string().max(200).nullable().optional(),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
});

export type AuditLogRow = {
  id: string;
  actor_id: string;
  actor_name: string | null;
  actor_email: string | null;
  actor_role: string | null;
  action_type: string;
  action_description: string;
  module_name: AuditModule;
  target_id: string | null;
  target_title: string | null;
  related_student_id: string | null;
  old_value: any;
  new_value: any;
  metadata: any;
  status: string;
  created_at: string;
};

export const listAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const admin = await isAdmin(ctx);
    let q = ctx.supabase
      .from("admin_activity_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (!admin) q = q.eq("actor_id", ctx.userId);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    if (data.actorId) q = q.eq("actor_id", data.actorId);
    if (data.module) q = q.eq("module_name", data.module);
    if (data.actionType) q = q.eq("action_type", data.actionType);
    if (data.studentId) q = q.eq("related_student_id", data.studentId);
    if (data.search) {
      const s = data.search.replace(/[%_]/g, (m) => `\\${m}`);
      q = q.or(
        [
          `action_description.ilike.%${s}%`,
          `actor_name.ilike.%${s}%`,
          `actor_email.ilike.%${s}%`,
          `target_title.ilike.%${s}%`,
          `action_type.ilike.%${s}%`,
        ].join(","),
      );
    }
    q = q.range(data.offset, data.offset + data.limit - 1);
    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);
    return {
      rows: (rows ?? []) as AuditLogRow[],
      total: count ?? 0,
      isAdmin: admin,
    };
  });

export const getAuditLogSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    const admin = await isAdmin(ctx);
    if (!admin) throw new Error("Forbidden");
    // Today window in Asia/Kolkata (matches streak convention).
    const now = new Date();
    const kolkataMs = now.getTime() + 5.5 * 3600 * 1000;
    const startKol = new Date(kolkataMs);
    startKol.setUTCHours(0, 0, 0, 0);
    const startUtc = new Date(startKol.getTime() - 5.5 * 3600 * 1000);
    const startIso = startUtc.toISOString();

    const { data, error } = await ctx.supabase
      .from("admin_activity_logs")
      .select("module_name, related_student_id, action_type")
      .gte("created_at", startIso);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<{
      module_name: string;
      related_student_id: string | null;
      action_type: string;
    }>;
    return {
      totalToday: rows.length,
      homework: rows.filter((r) => r.module_name === "homework").length,
      mockTest: rows.filter((r) => r.module_name === "mock_test").length,
      student: rows.filter(
        (r) =>
          r.related_student_id ||
          r.module_name === "student" ||
          r.module_name === "marks",
      ).length,
      ai: rows.filter(
        (r) => r.module_name === "ai" || r.action_type.startsWith("ai."),
      ).length,
    };
  });

export const listAuditActors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    const admin = await isAdmin(ctx);
    if (!admin) throw new Error("Forbidden");
    const { data, error } = await ctx.supabase
      .from("admin_activity_logs")
      .select("actor_id, actor_name, actor_email, actor_role")
      .order("actor_name", { ascending: true })
      .limit(1000);
    if (error) throw new Error(error.message);
    const seen = new Set<string>();
    const actors: Array<{
      id: string;
      name: string | null;
      email: string | null;
      role: string | null;
    }> = [];
    for (const r of data ?? []) {
      if (seen.has(r.actor_id)) continue;
      seen.add(r.actor_id);
      actors.push({
        id: r.actor_id,
        name: r.actor_name,
        email: r.actor_email,
        role: r.actor_role,
      });
    }
    return actors;
  });

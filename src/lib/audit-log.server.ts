// Server-only audit-log helper. Called from inside server functions after a
// primary action succeeds. Logging failure NEVER breaks the primary action.

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  getRequestHeader,
  getRequestIP,
} from "@tanstack/react-start/server";

export type AuditModule =
  | "homework"
  | "mock_test"
  | "assignment"
  | "announcement"
  | "notification"
  | "student"
  | "marks"
  | "report"
  | "settings"
  | "ai";

export type AuditEntry = {
  actionType: string;
  description: string;
  moduleName: AuditModule;
  targetId?: string | null;
  targetTitle?: string | null;
  relatedStudentId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  metadata?: Record<string, unknown> | null;
  status?: "success" | "failed";
};

export function captureRequestContext(): Record<string, unknown> {
  const meta: Record<string, unknown> = {};
  try {
    const ip = getRequestIP({ xForwardedFor: true });
    if (ip) meta.ip = ip;
  } catch {
    /* ignore */
  }
  try {
    const ua = getRequestHeader("user-agent");
    if (ua) meta.user_agent = ua;
  } catch {
    /* ignore */
  }
  return meta;
}

/**
 * Best-effort audit-log write. Call from inside a server function AFTER the
 * primary action succeeds. Requires the authenticated `supabase` client from
 * `requireSupabaseAuth` context.
 */
export async function logAdminActivity(
  supabase: any,
  entry: AuditEntry,
): Promise<void> {
  try {
    const meta = { ...captureRequestContext(), ...(entry.metadata ?? {}) };
    const { error } = await supabase.rpc("log_admin_activity", {
      _action_type: entry.actionType,
      _action_description: entry.description,
      _module_name: entry.moduleName,
      _target_id: entry.targetId ?? null,
      _target_title: entry.targetTitle ?? null,
      _related_student_id: entry.relatedStudentId ?? null,
      _old_value: entry.oldValue ?? null,
      _new_value: entry.newValue ?? null,
      _metadata: meta,
      _status: entry.status ?? "success",
    });
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[audit-log]", entry.actionType, error.message);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[audit-log] threw", entry.actionType, e);
  }
}

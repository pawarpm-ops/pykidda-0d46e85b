// Client-side wrapper around the `logAdminAction` server function.
// Fire-and-forget: never throws to the caller — a logging failure must not
// break the primary admin action.
import { logAdminAction } from "@/lib/audit-log.functions";

export type ClientAuditEntry = {
  actionType: string;
  description: string;
  moduleName:
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
  targetId?: string | null;
  targetTitle?: string | null;
  relatedStudentId?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  oldValue?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  newValue?: any;
  metadata?: Record<string, unknown> | null;
  status?: "success" | "failed";
};

export async function logAdminActionClient(
  entry: ClientAuditEntry,
): Promise<void> {
  try {
    await logAdminAction({ data: entry });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[audit-log] client log failed", entry.actionType, e);
  }
}

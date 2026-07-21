import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { DatePicker } from "@/components/ui/date-picker";
import {
  getAuditLogSummary,
  listAuditActors,
  listAuditLogs,
  type AuditLogRow,
} from "@/lib/audit-log.functions";


const MODULES = [
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
] as const;

const MODULE_META: Record<
  string,
  { icon: string; label: string; tone: string }
> = {
  homework: { icon: "📝", label: "Homework", tone: "oklch(0.75 0.14 60)" },
  mock_test: { icon: "🧪", label: "Mock test", tone: "oklch(0.72 0.16 285)" },
  assignment: { icon: "📚", label: "Assignment", tone: "oklch(0.72 0.15 200)" },
  announcement: {
    icon: "📣",
    label: "Announcement",
    tone: "oklch(0.75 0.16 40)",
  },
  notification: {
    icon: "🔔",
    label: "Notification",
    tone: "oklch(0.75 0.15 100)",
  },
  student: { icon: "👤", label: "Student", tone: "oklch(0.72 0.15 145)" },
  marks: { icon: "💯", label: "Marks", tone: "oklch(0.72 0.16 25)" },
  report: { icon: "📊", label: "Report", tone: "oklch(0.72 0.13 240)" },
  settings: { icon: "⚙️", label: "Settings", tone: "oklch(0.7 0.05 250)" },
  ai: { icon: "🤖", label: "AI", tone: "oklch(0.75 0.18 320)" },
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function moduleBadge(module: string) {
  const meta = MODULE_META[module] ?? {
    icon: "•",
    label: module,
    tone: "oklch(0.7 0.05 250)",
  };
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold"
      style={{
        borderColor: `${meta.tone} / 0.4` as unknown as string,
        color: meta.tone,
        backgroundColor: `${meta.tone.replace(")", " / 0.12)")}` as string,
      }}
    >
      <span>{meta.icon}</span>
      <span className="tracking-wide">{meta.label}</span>
    </span>
  );
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: AuditLogRow[]): string {
  const headers = [
    "created_at",
    "actor_name",
    "actor_email",
    "actor_role",
    "module_name",
    "action_type",
    "action_description",
    "target_id",
    "target_title",
    "related_student_id",
    "old_value",
    "new_value",
    "metadata",
    "status",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.created_at,
        r.actor_name,
        r.actor_email,
        r.actor_role,
        r.module_name,
        r.action_type,
        r.action_description,
        r.target_id,
        r.target_title,
        r.related_student_id,
        r.old_value,
        r.new_value,
        r.metadata,
        r.status,
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  return lines.join("\n");
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function AuditLogsTab({
  students,
}: {
  students: Array<{ user_id: string; name: string }>;
}) {
  const list = useServerFn(listAuditLogs);
  const summaryFn = useServerFn(getAuditLogSummary);
  const actorsFn = useServerFn(listAuditActors);

  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [isAdmin, setIsAdmin] = useState(true);
  const [summary, setSummary] = useState<{
    totalToday: number;
    homework: number;
    mockTest: number;
    student: number;
    ai: number;
  } | null>(null);
  const [actors, setActors] = useState<
    Array<{ id: string; name: string | null; email: string | null }>
  >([]);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [actorId, setActorId] = useState("");
  const [module, setModule] = useState("");
  const [studentId, setStudentId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 50;
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<AuditLogRow | null>(null);

  const studentById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of students) m[s.user_id] = s.name;
    return m;
  }, [students]);

  useEffect(() => {
    void (async () => {
      try {
        const [s, a] = await Promise.all([
          summaryFn().catch(() => null),
          actorsFn().catch(() => []),
        ]);
        if (s) setSummary(s);
        if (Array.isArray(a)) setActors(a);
      } catch {
        /* ignore */
      }
    })();
  }, [summaryFn, actorsFn]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const res = await list({
          data: {
            from: from ? new Date(from).toISOString() : null,
            to: to ? new Date(to + "T23:59:59.999").toISOString() : null,
            actorId: actorId || null,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            module: (module || null) as any,
            studentId: studentId || null,
            search: search.trim() || null,
            limit: pageSize,
            offset: page * pageSize,
          },
        });
        if (!alive) return;
        setRows(res.rows);
        setTotal(res.total);
        setIsAdmin(res.isAdmin);
      } catch (e) {
        console.error("audit list failed", e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [list, from, to, actorId, module, studentId, search, page]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const exportCsv = () => {
    downloadFile(
      toCsv(rows),
      `activity-logs-${new Date().toISOString().slice(0, 10)}.csv`,
      "text/csv;charset=utf-8",
    );
  };

  const exportPdf = () => {
    // Simple printable view: open a new window with a styled table and trigger print.
    const w = window.open("", "_blank", "width=1024,height=800");
    if (!w) return;
    const styled = rows
      .map(
        (r) => `
      <tr>
        <td>${fmtDate(r.created_at)}</td>
        <td>${r.actor_name ?? ""}<br/><small>${r.actor_email ?? ""}</small></td>
        <td>${r.actor_role ?? ""}</td>
        <td>${MODULE_META[r.module_name]?.label ?? r.module_name}</td>
        <td>${r.action_type}</td>
        <td>${r.action_description}</td>
        <td>${r.target_title ?? r.target_id ?? ""}</td>
        <td>${r.related_student_id ? studentById[r.related_student_id] ?? r.related_student_id : ""}</td>
      </tr>`,
      )
      .join("");
    w.document.write(`<!doctype html><html><head><title>Activity Logs</title>
      <style>
        body{font-family:system-ui,sans-serif;padding:24px;color:#111}
        h1{font-size:18px;margin:0 0 12px}
        table{width:100%;border-collapse:collapse;font-size:11px}
        th,td{border:1px solid #ddd;padding:6px 8px;text-align:left;vertical-align:top}
        th{background:#f4f4f5}
        tr:nth-child(even){background:#fafafa}
      </style></head><body>
      <h1>Activity Logs — ${new Date().toLocaleString()}</h1>
      <p style="font-size:12px;color:#555">${rows.length} entr${rows.length === 1 ? "y" : "ies"} on this page (filters applied).</p>
      <table>
        <thead><tr>
          <th>Time</th><th>Teacher / Admin</th><th>Role</th>
          <th>Module</th><th>Action</th><th>Description</th>
          <th>Target</th><th>Student</th>
        </tr></thead>
        <tbody>${styled}</tbody>
      </table>
      <script>window.onload = () => setTimeout(() => window.print(), 250)</script>
    </body></html>`);
    w.document.close();
  };

  const resetFilters = () => {
    setFrom("");
    setTo("");
    setActorId("");
    setModule("");
    setStudentId("");
    setSearch("");
    setPage(0);
  };

  return (
    <section className="mt-6 space-y-6">
      <header>
        <h2 className="text-lg font-semibold">📜 Activity Logs</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {isAdmin
            ? "Every important admin/teacher action, tamper-resistant and searchable."
            : "Your own activity log entries."}
        </p>
      </header>

      {isAdmin && summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <SummaryCard label="Today" value={summary.totalToday} icon="📅" tone="oklch(0.72 0.15 240)" />
          <SummaryCard label="Homework" value={summary.homework} icon="📝" tone="oklch(0.75 0.14 60)" />
          <SummaryCard label="Mock tests" value={summary.mockTest} icon="🧪" tone="oklch(0.72 0.16 285)" />
          <SummaryCard label="Student" value={summary.student} icon="👤" tone="oklch(0.72 0.15 145)" />
          <SummaryCard label="AI actions" value={summary.ai} icon="🤖" tone="oklch(0.75 0.18 320)" />
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <FilterField label="From">
            <DatePicker
              value={from}
              onChange={(v) => {
                setFrom(v);
                setPage(0);
              }}
              placeholder="From date"
            />
          </FilterField>
          <FilterField label="To">
            <DatePicker
              value={to}
              onChange={(v) => {
                setTo(v);
                setPage(0);
              }}
              placeholder="To date"
            />
          </FilterField>
          {isAdmin && (
            <FilterField label="Teacher / Admin">
              <select
                value={actorId}
                onChange={(e) => {
                  setActorId(e.target.value);
                  setPage(0);
                }}
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              >
                <option value="">All</option>
                {actors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name ?? a.email ?? a.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </FilterField>
          )}
          <FilterField label="Module">
            <select
              value={module}
              onChange={(e) => {
                setModule(e.target.value);
                setPage(0);
              }}
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            >
              <option value="">All</option>
              {MODULES.map((m) => (
                <option key={m} value={m}>
                  {MODULE_META[m]?.label ?? m}
                </option>
              ))}
            </select>
          </FilterField>
          {isAdmin && (
            <FilterField label="Student">
              <select
                value={studentId}
                onChange={(e) => {
                  setStudentId(e.target.value);
                  setPage(0);
                }}
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              >
                <option value="">All</option>
                {students.map((s) => (
                  <option key={s.user_id} value={s.user_id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </FilterField>
          )}
          <FilterField label="Search">
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Name, title, action…"
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            />
          </FilterField>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <button
            onClick={resetFilters}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium"
          >
            Reset filters
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={exportCsv}
              disabled={!rows.length}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium disabled:opacity-50"
            >
              ⬇ Export CSV
            </button>
            <button
              onClick={exportPdf}
              disabled={!rows.length}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium disabled:opacity-50"
            >
              🖨 Export PDF
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-secondary/40 text-left text-[11px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Date & Time</th>
                <th className="px-3 py-2">Teacher / Admin</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Module</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Target</th>
                <th className="px-3 py-2">Student</th>
                <th className="px-3 py-2 text-right">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-xs text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-xs text-muted-foreground">
                    No activity found for the current filters.
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((r) => (
                  <tr key={r.id} className="border-t border-border/50 hover:bg-secondary/20">
                    <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-muted-foreground">
                      {fmtDate(r.created_at)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.actor_name ?? "—"}</div>
                      <div className="text-[11px] text-muted-foreground">{r.actor_email}</div>
                    </td>
                    <td className="px-3 py-2 text-xs uppercase tracking-widest text-muted-foreground">
                      {r.actor_role ?? "—"}
                    </td>
                    <td className="px-3 py-2">{moduleBadge(r.module_name)}</td>
                    <td className="px-3 py-2">
                      <div className="text-xs font-semibold">{r.action_description}</div>
                      <div className="text-[11px] text-muted-foreground">{r.action_type}</div>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {r.target_title ? (
                        <span className="line-clamp-1">{r.target_title}</span>
                      ) : r.target_id ? (
                        <code className="text-[11px]">{r.target_id.slice(0, 8)}…</code>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {r.related_student_id
                        ? studentById[r.related_student_id] ??
                          r.related_student_id.slice(0, 8) + "…"
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => setDetail(r)}
                        className="rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium hover:bg-secondary/40"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-border/60 px-3 py-2 text-xs text-muted-foreground">
          <span>
            {total.toLocaleString()} total entr{total === 1 ? "y" : "ies"} · page {page + 1} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-md border border-border bg-background px-2 py-1 disabled:opacity-40"
            >
              ← Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page + 1 >= totalPages}
              className="rounded-md border border-border bg-background px-2 py-1 disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {detail && (
        <DetailModal
          row={detail}
          onClose={() => setDetail(null)}
          studentName={
            detail.related_student_id
              ? studentById[detail.related_student_id] ?? null
              : null
          }
        />
      )}
    </section>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: string;
  tone: string;
}) {
  return (
    <div
      className="rounded-xl border p-3 shadow-sm"
      style={{ borderColor: `${tone.replace(")", " / 0.35)")}` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <span className="text-lg" aria-hidden>
          {icon}
        </span>
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums" style={{ color: tone }}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function DetailModal({
  row,
  onClose,
  studentName,
}: {
  row: AuditLogRow;
  onClose: () => void;
  studentName: string | null;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
        <header className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div>
            <div className="flex items-center gap-2">
              {moduleBadge(row.module_name)}
              <span className="text-xs font-mono text-muted-foreground">{row.action_type}</span>
            </div>
            <h3 className="mt-2 text-base font-semibold">{row.action_description}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {fmtDate(row.created_at)} · by {row.actor_name ?? "—"} ({row.actor_role})
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-border bg-background px-3 py-1 text-sm"
          >
            Close
          </button>
        </header>
        <div className="grid gap-4 p-4 text-sm sm:grid-cols-2">
          <DetailRow label="Actor email" value={row.actor_email} />
          <DetailRow label="Status" value={row.status} />
          <DetailRow
            label="Target"
            value={row.target_title ?? row.target_id ?? "—"}
          />
          <DetailRow
            label="Related student"
            value={studentName ?? row.related_student_id ?? "—"}
          />
        </div>
        {(row.old_value || row.new_value) && (
          <div className="grid gap-3 border-t border-border p-4 text-xs sm:grid-cols-2">
            {row.old_value !== null && row.old_value !== undefined && (
              <JsonBlock title="Old value" data={row.old_value} tone="destructive" />
            )}
            {row.new_value !== null && row.new_value !== undefined && (
              <JsonBlock title="New value" data={row.new_value} tone="success" />
            )}
          </div>
        )}
        {row.metadata && Object.keys(row.metadata as object).length > 0 && (
          <div className="border-t border-border p-4">
            <JsonBlock title="Metadata" data={row.metadata} tone="muted" />
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 break-words">{value ?? "—"}</p>
    </div>
  );
}

function JsonBlock({
  title,
  data,
  tone,
}: {
  title: string;
  data: unknown;
  tone: "destructive" | "success" | "muted";
}) {
  const border =
    tone === "destructive"
      ? "border-destructive/40"
      : tone === "success"
        ? "border-[oklch(0.65_0.16_145)]/40"
        : "border-border";
  const bg =
    tone === "destructive"
      ? "bg-destructive/5"
      : tone === "success"
        ? "bg-[oklch(0.65_0.16_145)]/5"
        : "bg-secondary/40";
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </p>
      <pre
        className={`max-h-56 overflow-auto rounded-md border p-2 text-[11px] leading-snug ${border} ${bg}`}
      >
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

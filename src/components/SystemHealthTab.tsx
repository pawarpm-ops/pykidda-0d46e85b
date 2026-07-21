import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { DatePicker } from "@/components/ui/date-picker";
import {
  deleteHealthLog,
  getHealthSummary,
  listHealthLogs,
  updateHealthLogStatus,
  type HealthLogRow,
} from "@/lib/system-health.functions";


const CATEGORIES = [
  "ai",
  "pdf",
  "login",
  "api",
  "performance",
  "pyodide",
] as const;

const CAT_META: Record<
  string,
  { icon: string; label: string; tone: string }
> = {
  ai: { icon: "🤖", label: "AI", tone: "oklch(0.75 0.18 320)" },
  pdf: { icon: "📄", label: "PDF", tone: "oklch(0.72 0.15 25)" },
  login: { icon: "🔐", label: "Login", tone: "oklch(0.72 0.15 60)" },
  api: { icon: "🛰", label: "API", tone: "oklch(0.72 0.15 200)" },
  performance: { icon: "⚡", label: "Performance", tone: "oklch(0.75 0.14 100)" },
  pyodide: { icon: "🐍", label: "Pyodide", tone: "oklch(0.72 0.15 145)" },
};

const SEV_META: Record<
  string,
  { label: string; tone: string }
> = {
  low: { label: "Low", tone: "oklch(0.7 0.05 250)" },
  medium: { label: "Medium", tone: "oklch(0.75 0.14 60)" },
  high: { label: "High", tone: "oklch(0.72 0.15 25)" },
  critical: { label: "Critical", tone: "oklch(0.62 0.22 25)" },
};

const STATUS_META: Record<string, { label: string; tone: string }> = {
  new: { label: "New", tone: "oklch(0.72 0.15 240)" },
  reviewed: { label: "Reviewed", tone: "oklch(0.72 0.13 100)" },
  resolved: { label: "Resolved", tone: "oklch(0.72 0.15 145)" },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function catBadge(cat: string) {
  const meta = CAT_META[cat] ?? { icon: "•", label: cat, tone: "oklch(0.7 0.05 250)" };
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold"
      style={{
        borderColor: meta.tone,
        color: meta.tone,
        backgroundColor: meta.tone.replace(")", " / 0.12)"),
      }}
    >
      <span>{meta.icon}</span>
      <span>{meta.label}</span>
    </span>
  );
}

function sevBadge(sev: string) {
  const meta = SEV_META[sev] ?? SEV_META.medium;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-widest"
      style={{
        borderColor: meta.tone,
        color: meta.tone,
        backgroundColor: meta.tone.replace(")", " / 0.12)"),
      }}
    >
      {sev === "critical" ? "🔴" : sev === "high" ? "🟠" : sev === "medium" ? "🟡" : "🟢"}
      {meta.label}
    </span>
  );
}

function statusBadge(s: string) {
  const meta = STATUS_META[s] ?? STATUS_META.new;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold"
      style={{
        borderColor: meta.tone,
        color: meta.tone,
        backgroundColor: meta.tone.replace(")", " / 0.12)"),
      }}
    >
      {meta.label}
    </span>
  );
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadFile(content: string, name: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function SystemHealthTab() {
  const list = useServerFn(listHealthLogs);
  const summaryFn = useServerFn(getHealthSummary);
  const updateFn = useServerFn(updateHealthLogStatus);
  const deleteFn = useServerFn(deleteHealthLog);

  const [rows, setRows] = useState<HealthLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<
    Array<{ category: string; count_today: number; count_7d: number; critical_today: number }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [detail, setDetail] = useState<HealthLogRow | null>(null);

  // Filters
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [moduleName, setModuleName] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 50;

  useEffect(() => {
    void (async () => {
      try {
        const s = await summaryFn();
        setSummary(s);
      } catch {
        /* ignore */
      }
    })();
  }, [summaryFn, reloadKey]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const res = await list({
          data: {
            from: from ? new Date(from).toISOString() : null,
            to: to ? new Date(to + "T23:59:59.999").toISOString() : null,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            category: (category || null) as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            severity: (severity || null) as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            status: (status || null) as any,
            userEmail: userEmail.trim() || null,
            moduleName: moduleName.trim() || null,
            search: search.trim() || null,
            limit: pageSize,
            offset: page * pageSize,
          },
        });
        if (!alive) return;
        setRows(res.rows);
        setTotal(res.total);
      } catch (e) {
        console.error("health list failed", e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [list, from, to, category, severity, status, userEmail, moduleName, search, page, reloadKey]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const summaryBy = useMemo(() => {
    const m: Record<string, { today: number; week: number; critical: number }> = {};
    for (const s of summary) {
      m[s.category] = {
        today: Number(s.count_today) || 0,
        week: Number(s.count_7d) || 0,
        critical: Number(s.critical_today) || 0,
      };
    }
    return m;
  }, [summary]);

  const totalToday = summary.reduce((n, s) => n + (Number(s.count_today) || 0), 0);
  const criticalToday = summary.reduce((n, s) => n + (Number(s.critical_today) || 0), 0);
  const overallStatus: "healthy" | "warning" | "critical" =
    criticalToday > 0 || totalToday > 20
      ? "critical"
      : totalToday >= 5
        ? "warning"
        : "healthy";
  const overallTone =
    overallStatus === "critical"
      ? "oklch(0.62 0.22 25)"
      : overallStatus === "warning"
        ? "oklch(0.75 0.16 60)"
        : "oklch(0.72 0.15 145)";
  const overallText =
    overallStatus === "critical"
      ? `System Status: Critical — ${criticalToday} critical issue${criticalToday === 1 ? "" : "s"} today`
      : overallStatus === "warning"
        ? `System Status: Warning — ${totalToday} issues detected today`
        : "System Status: Healthy — no notable issues today";

  const exportCsv = () => {
    const headers = [
      "created_at",
      "category",
      "severity",
      "status",
      "module_name",
      "page_route",
      "user_email",
      "status_code",
      "duration_ms",
      "error_message",
    ];
    const lines = [headers.join(",")];
    for (const r of rows) {
      lines.push(
        [
          r.created_at,
          r.category,
          r.severity,
          r.status,
          r.module_name,
          r.page_route,
          r.user_email,
          r.status_code,
          r.duration_ms,
          r.error_message,
        ]
          .map(csvEscape)
          .join(","),
      );
    }
    downloadFile(
      lines.join("\n"),
      `system-health-${new Date().toISOString().slice(0, 10)}.csv`,
      "text/csv;charset=utf-8",
    );
  };

  const exportPdf = () => {
    const w = window.open("", "_blank", "width=1024,height=800");
    if (!w) return;
    const body = rows
      .map(
        (r) => `
      <tr>
        <td>${fmtDate(r.created_at)}</td>
        <td>${CAT_META[r.category]?.label ?? r.category}</td>
        <td>${SEV_META[r.severity]?.label ?? r.severity}</td>
        <td>${STATUS_META[r.status]?.label ?? r.status}</td>
        <td>${r.module_name ?? ""}<br/><small>${r.page_route ?? ""}</small></td>
        <td>${r.user_email ?? ""}</td>
        <td>${escapeHtml(r.error_message)}</td>
      </tr>`,
      )
      .join("");
    w.document.write(`<!doctype html><html><head><title>System Health</title>
      <style>
        body{font-family:system-ui,sans-serif;padding:24px;color:#111}
        h1{font-size:18px;margin:0 0 12px}
        table{width:100%;border-collapse:collapse;font-size:11px}
        th,td{border:1px solid #ddd;padding:6px 8px;text-align:left;vertical-align:top}
        th{background:#f4f4f5}
        tr:nth-child(even){background:#fafafa}
      </style></head><body>
      <h1>System Health Logs — ${new Date().toLocaleString()}</h1>
      <p style="font-size:12px;color:#555">${rows.length} entries on this page (filters applied).</p>
      <table>
        <thead><tr>
          <th>Time</th><th>Category</th><th>Severity</th><th>Status</th>
          <th>Module / Route</th><th>User</th><th>Error</th>
        </tr></thead>
        <tbody>${body}</tbody>
      </table>
      <script>window.onload = () => setTimeout(() => window.print(), 250)</script>
    </body></html>`);
    w.document.close();
  };

  const resetFilters = () => {
    setFrom("");
    setTo("");
    setCategory("");
    setSeverity("");
    setStatus("");
    setUserEmail("");
    setModuleName("");
    setSearch("");
    setPage(0);
  };

  const changeStatus = async (id: string, newStatus: "reviewed" | "resolved") => {
    try {
      await updateFn({ data: { id, status: newStatus } });
      setReloadKey((k) => k + 1);
      setDetail(null);
    } catch (e) {
      console.error(e);
      alert("Failed to update status.");
    }
  };

  const removeRow = async (id: string) => {
    if (!confirm("Delete this log entry? This cannot be undone.")) return;
    try {
      await deleteFn({ data: { id } });
      setReloadKey((k) => k + 1);
      setDetail(null);
    } catch (e) {
      console.error(e);
      alert("Failed to delete.");
    }
  };

  return (
    <section className="mt-6 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">🩺 System Health</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Failed AI requests, PDF downloads, logins, API errors, slow pages, and Pyodide crashes — all in one place.
          </p>
        </div>
        <div
          className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
          style={{
            borderColor: overallTone,
            color: overallTone,
            backgroundColor: overallTone.replace(")", " / 0.12)"),
          }}
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: overallTone }}
          />
          {overallText}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {CATEGORIES.map((c) => {
          const s = summaryBy[c] ?? { today: 0, week: 0, critical: 0 };
          const tone =
            s.critical > 0
              ? "oklch(0.62 0.22 25)"
              : s.today >= 5
                ? "oklch(0.75 0.16 60)"
                : s.today > 0
                  ? "oklch(0.72 0.15 240)"
                  : "oklch(0.72 0.15 145)";
          const meta = CAT_META[c];
          return (
            <div
              key={c}
              className="rounded-xl border p-3 shadow-sm transition hover:border-accent/60"
              style={{ borderColor: tone.replace(")", " / 0.35)") }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {meta.label}
                </span>
                <span className="text-lg" aria-hidden>{meta.icon}</span>
              </div>
              <div className="mt-1 text-2xl font-bold tabular-nums" style={{ color: tone }}>
                {s.today.toLocaleString()}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                today · {s.week} in 7d
                {s.critical > 0 ? ` · ${s.critical} crit` : ""}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <FilterField label="From">
            <DatePicker value={from} onChange={(v) => { setFrom(v); setPage(0); }} placeholder="From date" />
          </FilterField>
          <FilterField label="To">
            <DatePicker value={to} onChange={(v) => { setTo(v); setPage(0); }} placeholder="To date" />
          </FilterField>
          <FilterField label="Category">
            <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(0); }} className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm">
              <option value="">All</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{CAT_META[c].label}</option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Severity">
            <select value={severity} onChange={(e) => { setSeverity(e.target.value); setPage(0); }} className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm">
              <option value="">All</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </FilterField>
          <FilterField label="Status">
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm">
              <option value="">All</option>
              <option value="new">New</option>
              <option value="reviewed">Reviewed</option>
              <option value="resolved">Resolved</option>
            </select>
          </FilterField>
          <FilterField label="User email">
            <input value={userEmail} onChange={(e) => { setUserEmail(e.target.value); setPage(0); }} placeholder="user@…" className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm" />
          </FilterField>
          <FilterField label="Module / route">
            <input value={moduleName} onChange={(e) => { setModuleName(e.target.value); setPage(0); }} placeholder="e.g. mock-tests" className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm" />
          </FilterField>
          <FilterField label="Search error">
            <input type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Message, route, user…" className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm" />
          </FilterField>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <button onClick={resetFilters} className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium">
            Reset filters
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setReloadKey((k) => k + 1)} className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium">
              ↻ Refresh
            </button>
            <button onClick={exportCsv} disabled={!rows.length} className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium disabled:opacity-50">
              ⬇ Export CSV
            </button>
            <button onClick={exportPdf} disabled={!rows.length} className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium disabled:opacity-50">
              🖨 Download PDF
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-secondary/40 text-left text-[11px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Date &amp; Time</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Module / Page</th>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Error / Issue</th>
                <th className="px-3 py-2">Severity</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-xs text-muted-foreground">Loading…</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-xs text-muted-foreground">No issues logged for the current filters. 🎉</td></tr>
              )}
              {!loading && rows.map((r) => (
                <tr key={r.id} className="border-t border-border/50 hover:bg-secondary/20">
                  <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-muted-foreground">{fmtDate(r.created_at)}</td>
                  <td className="px-3 py-2">{catBadge(r.category)}</td>
                  <td className="px-3 py-2 text-xs">
                    <div className="font-medium">{r.module_name ?? "—"}</div>
                    {r.page_route && <div className="text-[11px] text-muted-foreground">{r.page_route}</div>}
                  </td>
                  <td className="px-3 py-2 text-xs">{r.user_email ?? <span className="text-muted-foreground">anon</span>}</td>
                  <td className="px-3 py-2 text-xs">
                    <div className="line-clamp-2 max-w-md">{r.error_message}</div>
                    {r.status_code && <div className="text-[11px] text-muted-foreground">HTTP {r.status_code}</div>}
                  </td>
                  <td className="px-3 py-2">{sevBadge(r.severity)}</td>
                  <td className="px-3 py-2">{statusBadge(r.status)}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => setDetail(r)} className="rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium hover:bg-secondary/40">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-border/60 px-3 py-2 text-xs text-muted-foreground">
          <span>{total.toLocaleString()} total · page {page + 1} of {totalPages}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="rounded-md border border-border bg-background px-2 py-1 disabled:opacity-40">← Prev</button>
            <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page + 1 >= totalPages} className="rounded-md border border-border bg-background px-2 py-1 disabled:opacity-40">Next →</button>
          </div>
        </div>
      </div>

      {detail && (
        <DetailModal
          row={detail}
          onClose={() => setDetail(null)}
          onMarkReviewed={() => changeStatus(detail.id, "reviewed")}
          onMarkResolved={() => changeStatus(detail.id, "resolved")}
          onDelete={() => removeRow(detail.id)}
        />
      )}
    </section>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function DetailModal({
  row,
  onClose,
  onMarkReviewed,
  onMarkResolved,
  onDelete,
}: {
  row: HealthLogRow;
  onClose: () => void;
  onMarkReviewed: () => void;
  onMarkResolved: () => void;
  onDelete: () => void;
}) {
  const suggested = suggestAction(row);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {catBadge(row.category)}
              {sevBadge(row.severity)}
              {statusBadge(row.status)}
            </div>
            <h3 className="mt-2 text-base font-semibold break-words">{row.error_message}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {fmtDate(row.created_at)} · {row.user_email ?? "anon"}
              {row.status_code ? ` · HTTP ${row.status_code}` : ""}
              {row.duration_ms ? ` · ${row.duration_ms}ms` : ""}
            </p>
          </div>
          <button onClick={onClose} className="rounded-md border border-border bg-background px-2 py-1 text-xs">Close</button>
        </header>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto p-4 text-xs">
          <Section label="Module / Route">
            <div><b>Module:</b> {row.module_name ?? "—"}</div>
            <div><b>Route:</b> {row.page_route ?? "—"}</div>
          </Section>
          {suggested && (
            <Section label="Suggested action">
              <p className="text-muted-foreground">{suggested}</p>
            </Section>
          )}
          {row.error_details && (
            <Section label="Error details">
              <pre className="overflow-x-auto rounded-md border border-border bg-background p-2 text-[11px]">{JSON.stringify(row.error_details, null, 2)}</pre>
            </Section>
          )}
          {row.device_info && (
            <Section label="Device / browser">
              <pre className="overflow-x-auto rounded-md border border-border bg-background p-2 text-[11px]">{JSON.stringify(row.device_info, null, 2)}</pre>
            </Section>
          )}
          <Section label="Timeline">
            <div>Created: {fmtDate(row.created_at)}</div>
            {row.reviewed_at && <div>Reviewed: {fmtDate(row.reviewed_at)}</div>}
            {row.resolved_at && <div>Resolved: {fmtDate(row.resolved_at)}</div>}
          </Section>
        </div>
        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border p-3">
          <button onClick={onDelete} className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/20">
            🗑 Delete
          </button>
          {row.status !== "reviewed" && row.status !== "resolved" && (
            <button onClick={onMarkReviewed} className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold">
              ✓ Mark reviewed
            </button>
          )}
          {row.status !== "resolved" && (
            <button onClick={onMarkResolved} className="rounded-md px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-[var(--shadow-warm)]" style={{ backgroundImage: "var(--gradient-sunrise)" }}>
              ✓ Mark resolved
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function suggestAction(row: HealthLogRow): string | null {
  switch (row.category) {
    case "ai":
      return "Check the AI Gateway logs for the same time window. If cost/rate limit — top up credits or throttle usage. If model errors — try a different model.";
    case "pdf":
      return "Ask the user to retry after refreshing. If persistent, check the specific page's data volume or try a smaller export.";
    case "login":
      return "Confirm Google OAuth is still enabled in Cloud auth settings. Repeated failures for one email may indicate a spelling mistake or provider outage.";
    case "api":
      return "Check the server function logs and database health. Repeated 5xx errors may need a server restart or query optimization.";
    case "performance":
      return row.duration_ms && row.duration_ms >= 6000
        ? "Critical slowness — inspect that route's loaders/queries and consider caching or splitting components."
        : "Investigate this route's payload size, images, or API calls; consider lazy-loading heavy components.";
    case "pyodide":
      return "Ask the user to retry on a modern browser (Chrome/Edge/Firefox) with a stable connection. Recurring failures may need Pyodide version pinning.";
    default:
      return null;
  }
}

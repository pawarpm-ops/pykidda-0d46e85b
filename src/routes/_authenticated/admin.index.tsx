import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/lib/role";
import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
  type Announcement,
} from "@/lib/notifications";
import { listStudentAuthInfo, type StudentAuthInfo } from "@/lib/admin-users.functions";
import { getScreenshotSignedUrl } from "@/components/ReportProblem";
import { HomeworkAdminTab } from "./admin.assignments";
import { AdminMockOverview } from "@/components/AdminMockOverview";
import { ViolationAnalytics } from "@/components/ViolationAnalytics";
import { getQuestion } from "@/lib/questions";
import { TopStudentsChart } from "@/components/TopStudentsChart";
import { StreakDebugTab } from "@/components/StreakDebugTab";
import { AuditLogsTab } from "@/components/AuditLogsTab";
import { SystemHealthTab } from "@/components/SystemHealthTab";
import { logAdminActionClient } from "@/lib/audit-log-client";
import { BadgesGrid } from "@/components/BadgesGrid";
import { AdminBadgesOverview } from "@/components/AdminBadgesOverview";
import {
  LayoutDashboard,
  Users,
  Activity as ActivityIcon,
  Flame,
  Award,
  Megaphone,
  FileText,
  Star,
  ClipboardList,
  ScrollText,
  HeartPulse,
  FlaskConical,
  ArrowLeft,
  type LucideIcon,
  Trash2,
} from "lucide-react";
import { resetTeacherDashboardData } from "@/lib/admin-reset.functions";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Admin · PY Kidda" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
  ssr: false,
});

type StudentRow = {
  user_id: string;
  name: string;
  mocks: number;
  bestPct: number;
  avgPct: number;
  practiceAttempts: number;
  practiceSolved: number;
  violations: number;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null;
};

type StreakInfo = {
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
};

type MockRow = {
  id: string;
  user_id: string;
  test_id: string;
  test_name: string;
  student_name: string | null;
  percentage: number;
  grade: string;
  marks_obtained: number;
  total_marks: number;
  time_taken_sec: number;
  submission_type: string;
  violation_reason: string | null;
  submitted_at: string;
};

type PracticeRow = {
  id: string;
  user_id: string;
  question_id: string;
  unit: number;
  passed: number;
  total: number;
  solved: boolean;
  attempted_at: string;
};
type ProfileInfo = {
  display_name: string | null;
  full_name: string | null;
  contact_number: string | null;
  college_name: string | null;
  age: number | null;
  gender: string | null;
  birth_date: string | null;
  onboarded: boolean | null;
  student_unique_id: string | null;
};


const C = {
  primary: "oklch(0.62 0.18 250)",
  accent: "oklch(0.72 0.16 60)",
  good: "oklch(0.65 0.16 145)",
  warn: "oklch(0.78 0.16 85)",
  bad: "oklch(0.60 0.22 25)",
  teal: "oklch(0.70 0.14 195)",
};

function Stat({ label, value, tone = "default" }: { label: string; value: string | number; tone?: "default" | "good" | "bad" | "warn" }) {
  const ring =
    tone === "good"
      ? "border-l-[oklch(0.65_0.16_145)]"
      : tone === "bad"
        ? "border-l-destructive"
        : tone === "warn"
          ? "border-l-[oklch(0.78_0.16_85)]"
          : "border-l-accent";
  return (
    <div className={`rounded-xl border border-border border-l-4 ${ring} bg-card p-4 shadow-sm`}>
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-base font-semibold mb-3">{title}</h2>
      {children}
    </div>
  );
}

function ScoreDistributionCard({
  bands,
  total,
}: {
  bands: { name: string; value: number; color: string }[];
  total: number;
}) {
  const avg = total > 0
    ? Math.round(bands.reduce((sum, b, i) => {
        // midpoint per band: 90, 70, 50, 20
        const mid = [90, 70, 50, 20][i] ?? 0;
        return sum + b.value * mid;
      }, 0) / total)
    : 0;
  const topBand = bands.reduce((m, b) => (b.value > m.value ? b : m), bands[0]);

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/40">
      <div
        className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full opacity-[0.08] blur-3xl"
        style={{ background: `radial-gradient(circle, ${topBand?.color ?? "var(--primary)"}, transparent 70%)` }}
        aria-hidden
      />

      <div className="relative flex items-start justify-between gap-3 mb-1">
        <div>
          <h2 className="text-base font-semibold">Score distribution</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            How students performed across all mock attempts
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/40 px-2.5 py-1 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
          Avg {avg}%
        </div>
      </div>

      {total === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No data.</p>
      ) : (
        <div className="relative mt-4 grid gap-5 md:grid-cols-[1fr_1.1fr] items-center">
          <div className="relative mx-auto h-[220px] w-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={bands}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={2}
                  stroke="var(--card)"
                  strokeWidth={2}
                >
                  {bands.map((b, i) => (
                    <Cell key={i} fill={b.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "var(--popover-foreground)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                Attempts
              </span>
              <span className="text-3xl font-bold tabular-nums">{total}</span>
            </div>
          </div>

          <div className="grid gap-2">
            {bands.map((b) => {
              const pct = total > 0 ? Math.round((b.value / total) * 100) : 0;
              return (
                <div
                  key={b.name}
                  className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2 transition-colors hover:bg-muted/60"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ background: b.color, boxShadow: `0 0 10px ${b.color}` }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate">{b.name}</p>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-border/60 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-[width] duration-500"
                        style={{ width: `${pct}%`, background: b.color }}
                      />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold tabular-nums leading-none">{b.value}</p>
                    <p className="text-[10px] text-muted-foreground tabular-nums mt-0.5">{pct}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


function AdminPage() {
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"overview" | "students" | "activity" | "announce" | "reports" | "reviews" | "homework" | "streaks" | "audit" | "health" | "badges">("overview");
  const [overviewSubTab, setOverviewSubTab] = useState<"complete" | "mocks">("complete");
  const [mocks, setMocks] = useState<MockRow[]>([]);
  const [practice, setPractice] = useState<PracticeRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileInfo>>({});
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [authInfo, setAuthInfo] = useState<StudentAuthInfo[]>([]);
  const [streaks, setStreaks] = useState<Record<string, StreakInfo>>({});
  const [loading, setLoading] = useState(true);
  const [authorId, setAuthorId] = useState<string | null>(null);
  const overviewRef = useRef<HTMLDivElement>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const resetFn = useServerFn(resetTeacherDashboardData);

  const handleClearAll = async () => {
    setResetting(true);
    try {
      const res = await resetFn();
      const total = Object.values(res.cleared ?? {}).reduce((a, b) => a + Number(b || 0), 0);
      toast.success("Teacher dashboard cleared", {
        description: `Removed ${total} records across student activity tables.`,
      });
      setMocks([]);
      setStreaks({});
      setConfirmReset(false);
      setResetConfirmText("");
      // Reload to pull fresh (empty) state everywhere.
      setTimeout(() => window.location.reload(), 400);
    } catch (e) {
      console.error("[admin] reset failed", e);
      toast.error("Could not clear dashboard", {
        description: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setResetting(false);
    }
  };

  const handleDownloadOverviewPdf = async () => {
    if (!overviewRef.current) return;
    setDownloadingPdf(true);
    try {
      const { exportNodeToPdf } = await import("@/lib/pdf-export");
      await exportNodeToPdf(
        overviewRef.current,
        `overview-analytics-${new Date().toISOString().slice(0, 10)}`,
      );
      void logAdminActionClient({
        actionType: "report.overview_pdf_downloaded",
        description: "Downloaded overview analytics PDF",
        moduleName: "report",
      });
    } catch (err) {
      console.error("Overview PDF export failed", err);
      alert("Could not generate the PDF. Please try again.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const fetchAuthInfo = useServerFn(listStudentAuthInfo);


  useEffect(() => {
    if (isAdmin === null) return;
    if (isAdmin === false) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      const { data: u } = await supabase.auth.getUser();
      setAuthorId(u.user?.id ?? null);

      const [m, pr, sr, ai, st] = await Promise.all([
        supabase.from("mock_results").select("*").order("submitted_at", { ascending: false }).limit(1000),
        supabase.from("profiles").select("id, display_name, full_name, contact_number, college_name, age, gender, birth_date, onboarded, student_unique_id"),
        supabase.from("user_roles").select("user_id").eq("role", "student"),
        fetchAuthInfo().catch((e) => { console.error("auth info", e); return [] as StudentAuthInfo[]; }),
        supabase.from("student_streaks").select("user_id, current_streak, longest_streak, last_activity_date"),
      ]);
      setMocks((m.data ?? []) as MockRow[]);
      // Practice attempts are no longer persisted — see practice-attempts.functions.ts.
      setPractice([]);
      const pmap: Record<string, ProfileInfo> = {};
      for (const row of (pr.data ?? []) as Array<ProfileInfo & { id: string }>) {
        pmap[row.id] = {
          display_name: row.display_name,
          full_name: row.full_name,
          contact_number: row.contact_number,
          college_name: row.college_name,
          age: row.age,
          gender: row.gender,
          birth_date: row.birth_date,
          onboarded: row.onboarded,
          student_unique_id: row.student_unique_id,
        };
      }
      setProfiles(pmap);
      setStudentIds(((sr.data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id));
      setAuthInfo(ai);
      const smap: Record<string, StreakInfo> = {};
      for (const row of (st.data ?? []) as Array<StreakInfo & { user_id: string }>) {
        smap[row.user_id] = {
          current_streak: row.current_streak,
          longest_streak: row.longest_streak,
          last_activity_date: row.last_activity_date,
        };
      }
      setStreaks(smap);
      setLoading(false);
    })();
  }, [isAdmin, fetchAuthInfo]);


  const students = useMemo<StudentRow[]>(() => {
    const map = new Map<string, StudentRow>();
    const blankRow = (uid: string, name: string): StudentRow => ({
      user_id: uid,
      name,
      mocks: 0,
      bestPct: 0,
      avgPct: 0,
      practiceAttempts: 0,
      practiceSolved: 0,
      violations: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastActivityDate: null,
    });
    for (const uid of studentIds) {
      map.set(uid, blankRow(uid, profiles[uid]?.display_name || uid.slice(0, 8)));
    }
    for (const m of mocks) {
      const cur = map.get(m.user_id) ?? blankRow(m.user_id, m.student_name || profiles[m.user_id]?.display_name || m.user_id.slice(0, 8));
      cur.mocks += 1;
      cur.bestPct = Math.max(cur.bestPct, m.percentage);
      cur.avgPct = cur.avgPct + m.percentage;
      if (m.submission_type === "auto-violation") cur.violations += 1;
      map.set(m.user_id, cur);
    }
    for (const s of map.values()) {
      s.avgPct = s.mocks > 0 ? Math.round(s.avgPct / s.mocks) : 0;
    }
    const solvedSet = new Map<string, Set<string>>();
    for (const p of practice) {
      const cur = map.get(p.user_id) ?? blankRow(p.user_id, profiles[p.user_id]?.display_name || p.user_id.slice(0, 8));
      cur.practiceAttempts += 1;
      if (p.solved) {
        if (!solvedSet.has(p.user_id)) solvedSet.set(p.user_id, new Set());
        solvedSet.get(p.user_id)!.add(p.question_id);
      }
      map.set(p.user_id, cur);
    }
    for (const [uid, set] of solvedSet) {
      const cur = map.get(uid);
      if (cur) cur.practiceSolved = set.size;
    }
    for (const [uid, s] of Object.entries(streaks)) {
      const cur = map.get(uid) ?? blankRow(uid, profiles[uid]?.display_name || uid.slice(0, 8));
      cur.currentStreak = s.current_streak;
      cur.longestStreak = s.longest_streak;
      cur.lastActivityDate = s.last_activity_date;
      map.set(uid, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.avgPct - a.avgPct);
  }, [mocks, practice, profiles, studentIds, streaks]);


  if (isAdmin === null || loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <main className="mx-auto w-full max-w-[1600px] px-4 md:px-8 py-10">Loading admin dashboard…</main>
      </div>
    );
  }
  if (isAdmin === false) return <Navigate to="/" />;

  const totalStudents = students.length;
  const totalMocks = mocks.length;
  const totalPractice = practice.length;
  const allPcts = mocks.map((m) => m.percentage);
  const avgScore = allPcts.length ? Math.round(allPcts.reduce((a, b) => a + b, 0) / allPcts.length) : 0;
  const highest = allPcts.length ? Math.max(...allPcts) : 0;
  const lowest = allPcts.length ? Math.min(...allPcts) : 0;
  const violations = mocks.filter((m) => m.submission_type === "auto-violation").length;
  const normalSubs = totalMocks - violations;

  // Student-wise marks bar chart (avg across attempts)
  const studentChart = students.slice(0, 20).map((s) => ({
    name: s.name,
    avg: s.avgPct,
    best: s.bestPct,
    rollNo: profiles[s.user_id]?.student_unique_id ?? null,
  }));

  // Score distribution pie
  const bands = [
    { name: "Excellent (≥80%)", value: 0, color: C.good },
    { name: "Good (60–79%)", value: 0, color: C.teal },
    { name: "Average (40–59%)", value: 0, color: C.warn },
    { name: "Poor (<40%)", value: 0, color: C.bad },
  ];
  for (const p of allPcts) {
    if (p >= 80) bands[0].value++;
    else if (p >= 60) bands[1].value++;
    else if (p >= 40) bands[2].value++;
    else bands[3].value++;
  }

  // Submission integrity
  const subBreakdown = [
    { name: "Normal", value: normalSubs, color: C.good },
    { name: "Auto-submitted", value: violations, color: C.bad },
  ].filter((x) => x.value > 0);

  // Violation reasons
  const vcounts: Record<string, number> = {};
  for (const m of mocks) {
    if (m.submission_type !== "auto-violation") continue;
    const r = (m.violation_reason ?? "Unknown").replace(/—.*$/, "").trim();
    vcounts[r] = (vcounts[r] ?? 0) + 1;
  }
  const violationData = Object.entries(vcounts).map(([reason, count]) => ({ reason, count }));

  // Unit-wise average from practice
  const unitMap: Record<number, { passed: number; total: number; count: number }> = {};
  for (const p of practice) {
    const u = p.unit;
    if (!unitMap[u]) unitMap[u] = { passed: 0, total: 0, count: 0 };
    unitMap[u].passed += p.passed;
    unitMap[u].total += p.total;
    unitMap[u].count += 1;
  }
  const unitData = Object.entries(unitMap)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([u, v]) => ({
      unit: `Unit ${u}`,
      avgPct: v.total > 0 ? Math.round((v.passed / v.total) * 100) : 0,
      attempts: v.count,
    }));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1600px] px-4 md:px-8 py-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground/80 hover:border-primary/50 hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft size={16} />
          Go back
        </Link>
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-widest text-accent font-semibold">Admin</p>
            <h1 className="mt-1 text-3xl md:text-4xl font-bold tracking-tight">Teacher dashboard</h1>
            <p className="mt-1 text-muted-foreground">Track every student's progress and send announcements.</p>
          </div>
        </div>




        <div className="mt-6 grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
          <nav
            className="md:sticky md:top-6 md:self-start rounded-2xl border border-border bg-card p-2 shadow-[var(--shadow-warm)] flex md:flex-col gap-1 overflow-x-auto md:overflow-visible"
            aria-label="Admin sections"
          >
            {([
              { key: "overview", label: "Overview", icon: LayoutDashboard },
              { key: "students", label: "Students", icon: Users },
              { key: "activity", label: "Activity logs", icon: ActivityIcon },
              { key: "streaks", label: "Streaks", icon: Flame },
              
              { key: "announce", label: "Announcements", icon: Megaphone },
              { key: "reports", label: "Reports", icon: FileText },
              { key: "reviews", label: "Reviews", icon: Star },
              { key: "audit", label: "Audit log", icon: ScrollText },
              { key: "health", label: "System Health", icon: HeartPulse },
            ] as const).map((t) => {
              const Icon = t.icon;
              const selected = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  aria-current={selected ? "page" : undefined}
                  className={`inline-flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition text-left whitespace-nowrap ${
                    selected
                      ? "bg-accent text-accent-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{t.label}</span>
                </button>
              );
            })}

            <Link
              to="/admin/homework"
              className="inline-flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition whitespace-nowrap"
            >
              <ClipboardList className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Homework</span>
            </Link>

            <button
              type="button"
              onClick={() => navigate({ to: "/admin/ai-mock" })}
              className="inline-flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition whitespace-nowrap text-left"
              title="Open AI Mock Test Creator"
            >
              <FlaskConical className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>AI Mock Creator</span>
            </button>


          </nav>

          <div className="min-w-0">




        {tab === "overview" && (
          <>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {overviewSubTab === "mocks" ? (
                  <button
                    onClick={() => setOverviewSubTab("complete")}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold hover:border-accent/60 hover:bg-accent/5 transition"
                    aria-label="Back"
                  >
                    ← Back
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setOverviewSubTab("complete")}
                      className="inline-flex items-center gap-2 rounded-full border border-accent bg-accent/15 px-4 py-2 text-sm font-semibold text-accent-foreground transition"
                    >
                      📊 Total Overview
                    </button>
                    <button
                      onClick={() => setOverviewSubTab("mocks")}
                      className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold hover:border-accent/60 hover:bg-accent/5 transition"
                    >
                      🧪 Mock Test Overview
                    </button>
                  </>
                )}
              </div>
              {overviewSubTab === "complete" && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setConfirmReset(true)}
                    disabled={resetting}
                    className="inline-flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm font-semibold text-destructive hover:bg-destructive/20 disabled:opacity-60 transition"
                    title="Delete all student activity data"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                    Clear all
                  </button>
                  <button
                    onClick={handleDownloadOverviewPdf}
                    disabled={downloadingPdf}
                    className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)] disabled:opacity-60"
                    style={{ backgroundImage: "var(--gradient-sunrise)" }}
                  >
                    {downloadingPdf ? "Preparing PDF…" : "⬇ Download PDF"}
                  </button>
                </div>
              )}
            </div>

            {overviewSubTab === "mocks" && (
              <AdminMockOverview mocks={mocks as any} profiles={profiles as any} currentUserId={authorId} />
            )}


            {overviewSubTab === "complete" && (
              <>
            <div ref={overviewRef} className="bg-background p-2">

            <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

              <Stat label="Total students" value={totalStudents} />
              <Stat label="Mock tests conducted" value={totalMocks} />
              <Stat label="Practice attempts" value={totalPractice} />
              <Stat label="Average score" value={`${avgScore}%`} tone={avgScore >= 60 ? "good" : "warn"} />
              <Stat label="Highest score" value={`${highest}%`} tone="good" />
              <Stat label="Lowest score" value={`${lowest}%`} tone={lowest < 40 ? "bad" : "default"} />
              <Stat label="Normal submissions" value={normalSubs} tone="good" />
              <Stat label="Violations" value={violations} tone={violations > 0 ? "bad" : "default"} />
            </section>

            <section className="mt-6 grid gap-6 lg:grid-cols-2">
              <TopStudentsChart students={studentChart} />

              <ScoreDistributionCard bands={bands} total={allPcts.length} />



              <ChartCard title="Submission integrity">
                {subBreakdown.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No data.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={subBreakdown} dataKey="value" nameKey="name" innerRadius={50} outerRadius={95}>
                        {subBreakdown.map((b, i) => (
                          <Cell key={i} fill={b.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            </section>

            {violationData.length > 0 && (
              <section className="mt-6">
                <ViolationAnalytics mocks={mocks} />
              </section>
            )}
            </div>
              </>
            )}
          </>

        )}

        {tab === "students" && (
          <StudentsTab students={students} mocks={mocks} practice={practice} authInfo={authInfo} profiles={profiles} />
        )}

        {tab === "activity" && (
          <ActivityTab authInfo={authInfo} students={students} profiles={profiles} />
        )}

        {tab === "streaks" && (
          <StreakDebugTab students={students.map((s) => ({ user_id: s.user_id, name: s.name }))} />
        )}

        {tab === "audit" && (
          <AuditLogsTab students={students.map((s) => ({ user_id: s.user_id, name: s.name }))} />
        )}

        {tab === "health" && <SystemHealthTab />}

        {tab === "badges" && (
          <section className="mt-6">
            <h2 className="mb-4 text-xl font-semibold">Badge overview</h2>
            <AdminBadgesOverview />
          </section>
        )}

        {tab === "announce" && authorId && (
          <AnnounceTab authorId={authorId} students={students} />
        )}

        {tab === "reports" && <ReportsTab />}

        {tab === "reviews" && <ReviewsTab />}

        {tab === "homework" && (
          <section className="mt-6">
          </section>
        )}

          </div>
        </div>
      </main>

      {confirmReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-destructive/40 bg-card p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
                <Trash2 className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold">Clear all dashboard data?</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  This permanently deletes <strong>mock results, streaks, activity logs,
                  leaderboard scores, earned badges, mock comments and audit logs</strong> for
                  every student. Profiles, users, homework and questions are not affected.
                </p>
                <p className="mt-2 text-sm font-semibold text-destructive">
                  This cannot be undone.
                </p>
              </div>
            </div>

            <label className="mt-4 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Type <span className="text-destructive">CLEAR</span> to confirm
            </label>
            <input
              type="text"
              value={resetConfirmText}
              onChange={(e) => setResetConfirmText(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-destructive focus:outline-none"
              placeholder="CLEAR"
              autoFocus
            />

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => { setConfirmReset(false); setResetConfirmText(""); }}
                disabled={resetting}
                className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAll}
                disabled={resetting || resetConfirmText.trim() !== "CLEAR"}
                className="inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                {resetting ? "Clearing…" : "Yes, clear everything"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

  );
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function fmtRelative(iso: string | null | undefined) {
  if (!iso) return "Never";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "Never";
  const diff = Date.now() - t;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
function InfoCell({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-md border border-border bg-background/40 px-3 py-2">
      <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</dt>
      <dd className="font-medium break-words">{value && value.trim() ? value : "—"}</dd>
    </div>
  );
}


function StudentsTab({ students, mocks, practice, authInfo, profiles }: { students: StudentRow[]; mocks: MockRow[]; practice: PracticeRow[]; authInfo: StudentAuthInfo[]; profiles: Record<string, ProfileInfo> }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const selStudent = students.find((s) => s.user_id === selected);
  const selMocks = mocks.filter((m) => m.user_id === selected);
  const selPractice = practice.filter((p) => p.user_id === selected);
  const authMap = useMemo(() => {
    const m = new Map<string, StudentAuthInfo>();
    for (const a of authInfo) m.set(a.user_id, a);
    return m;
  }, [authInfo]);
  const selAuth = selected ? authMap.get(selected) : undefined;
  const reportRef = useRef<HTMLDivElement>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const handleDownloadStudentPdf = async () => {
    if (!reportRef.current || !selStudent) return;
    setDownloadingPdf(true);
    try {
      const { exportNodeToPdf } = await import("@/lib/pdf-export");
      const safeName = selStudent.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      await exportNodeToPdf(
        reportRef.current,
        `student-${safeName}-${new Date().toISOString().slice(0, 10)}`,
      );
      void logAdminActionClient({
        actionType: "report.student_pdf_downloaded",
        description: `Downloaded student report PDF: ${selStudent.name}`,
        moduleName: "report",
        relatedStudentId: selected ?? null,
        targetTitle: selStudent.name,
      });
    } catch (err) {
      console.error("Student PDF export failed", err);
      alert("Could not generate the PDF. Please try again.");
    } finally {
      setDownloadingPdf(false);
    }
  };


  const filteredStudents = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => {
      const email = authMap.get(s.user_id)?.email?.toLowerCase() ?? "";
      const displayName = profiles[s.user_id]?.display_name?.toLowerCase() ?? "";
      return (
        s.name.toLowerCase().includes(q) ||
        email.includes(q) ||
        displayName.includes(q) ||
        s.user_id.toLowerCase().includes(q)
      );
    });
  }, [query, students, authMap, profiles]);

  return (
    <section className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <p className="text-sm font-semibold mb-3">All students ({students.length})</p>
        <div className="relative mb-3 group">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-accent transition-colors"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search students…"
            aria-label="Search students"
            className="w-full rounded-full border border-border bg-background pl-9 pr-9 py-2.5 text-sm shadow-sm transition-all duration-200 focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/20 focus:shadow-md placeholder:text-muted-foreground"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          )}
        </div>
        {students.length === 0 ? (
          <p className="text-sm text-muted-foreground">No student activity yet.</p>
        ) : filteredStudents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No student found.</p>
        ) : (
          <ul className="divide-y divide-border max-h-[600px] overflow-auto">
            {filteredStudents.map((s) => (
              <li key={s.user_id}>
                <button
                  onClick={() => setSelected(s.user_id)}
                  className={`w-full text-left py-2.5 px-2 rounded-lg transition-all duration-200 ${
                    selected === s.user_id
                      ? "bg-accent/15 ring-1 ring-accent/40 shadow-[0_0_18px_-6px_color-mix(in_oklch,var(--accent)_55%,transparent)]"
                      : "hover:bg-accent/10 hover:ring-1 hover:ring-accent/30 hover:shadow-[0_0_16px_-6px_color-mix(in_oklch,var(--accent)_50%,transparent)] hover:-translate-y-[1px]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium truncate">{s.name}</p>
                    <span className="text-xs tabular-nums text-muted-foreground">{s.avgPct}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {s.mocks} mocks · {s.practiceSolved} solved · {s.violations} viol.
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    🔥 {s.currentStreak}d streak · best {s.longestStreak}d
                    {s.lastActivityDate ? ` · last ${s.lastActivityDate}` : ""}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>


      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        {!selStudent ? (
          <p className="text-sm text-muted-foreground">Select a student to view their detailed report.</p>
        ) : (
          <>
            <div className="mb-3 flex justify-end">
              <button
                onClick={handleDownloadStudentPdf}
                disabled={downloadingPdf}
                className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)] disabled:opacity-60"
                style={{ backgroundImage: "var(--gradient-sunrise)" }}
              >
                {downloadingPdf ? "Preparing PDF…" : "⬇ Download PDF"}
              </button>
            </div>
            <div ref={reportRef} className="bg-background p-2">
            <div className="flex items-end justify-between gap-3 flex-wrap">

              <div>
                <h2 className="text-xl font-bold">{selStudent.name}</h2>
                <p className="text-xs text-muted-foreground">User ID {selStudent.user_id}</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                <div className="rounded-md bg-secondary px-3 py-2">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Avg</p>
                  <p className="font-bold">{selStudent.avgPct}%</p>
                </div>
                <div className="rounded-md bg-secondary px-3 py-2">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Best</p>
                  <p className="font-bold">{selStudent.bestPct}%</p>
                </div>
                <div className="rounded-md bg-secondary px-3 py-2">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Viol.</p>
                  <p className="font-bold">{selStudent.violations}</p>
                </div>
                <div className="rounded-md bg-gradient-to-br from-orange-500/15 to-red-500/15 border border-orange-500/30 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">🔥 Streak</p>
                  <p className="font-bold">{selStudent.currentStreak}d</p>
                </div>
                <div className="rounded-md bg-secondary px-3 py-2">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Longest</p>
                  <p className="font-bold">{selStudent.longestStreak}d</p>
                </div>
              </div>
            </div>

            {(() => {
              const pi = profiles[selStudent.user_id];
              return (
                <>
                  <h3 className="mt-6 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                    Personal info
                    {pi && pi.onboarded === false && (
                      <span className="ml-2 inline-block rounded bg-destructive/15 px-2 py-0.5 text-[10px] text-destructive normal-case tracking-normal">
                        Onboarding incomplete
                      </span>
                    )}
                  </h3>
                  {!pi || !pi.onboarded ? (
                    <p className="mt-2 text-sm text-muted-foreground">Student has not completed onboarding yet.</p>
                  ) : (
                    <dl className="mt-2 grid gap-2 sm:grid-cols-2 text-sm">
                      <InfoCell label="Full name" value={pi.full_name} />
                      <InfoCell label="Contact number" value={pi.contact_number} />
                      <InfoCell label="College" value={pi.college_name} />
                      <InfoCell label="Age" value={pi.age?.toString() ?? null} />
                      <InfoCell label="Gender" value={pi.gender} />
                      <InfoCell label="Birth date" value={pi.birth_date} />
                    </dl>
                  )}
                </>
              );
            })()}

            <h3 className="mt-6 text-sm font-semibold uppercase tracking-widest text-muted-foreground">Account</h3>
            {!selAuth ? (
              <p className="mt-2 text-sm text-muted-foreground">No account details available.</p>
            ) : (
              <dl className="mt-2 grid gap-2 sm:grid-cols-2 text-sm">
                <div className="rounded-md border border-border bg-background/40 px-3 py-2">
                  <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">Email</dt>
                  <dd className="font-medium break-all">{selAuth.email ?? "—"}</dd>
                </div>
                <div className="rounded-md border border-border bg-background/40 px-3 py-2">
                  <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">Sign-in providers</dt>
                  <dd className="font-medium">{selAuth.providers.join(", ") || "—"}</dd>
                </div>
                <div className="rounded-md border border-border bg-background/40 px-3 py-2">
                  <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">Account created</dt>
                  <dd className="font-medium">{fmtDate(selAuth.created_at)}</dd>
                </div>
                <div className="rounded-md border border-border bg-background/40 px-3 py-2">
                  <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">Email confirmed</dt>
                  <dd className="font-medium">{fmtDate(selAuth.email_confirmed_at)}</dd>
                </div>
                <div className="rounded-md border border-border bg-background/40 px-3 py-2">
                  <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">Status</dt>
                  <dd className="font-medium">
                    {selAuth.is_banned ? (
                      <span className="text-destructive">Banned</span>
                    ) : selAuth.email_confirmed_at ? (
                      <span className="text-[oklch(0.4_0.16_145)]">Active</span>
                    ) : (
                      <span className="text-[oklch(0.6_0.16_85)]">Pending verification</span>
                    )}
                  </dd>
                </div>
                <div className="rounded-md border border-border bg-background/40 px-3 py-2">
                  <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">Phone</dt>
                  <dd className="font-medium">{selAuth.phone || "—"}</dd>
                </div>
              </dl>
            )}




            <h3 className="mt-6 text-sm font-semibold uppercase tracking-widest text-muted-foreground">Mock tests</h3>
            {selMocks.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">None.</p>
            ) : (
              <table className="mt-2 w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground border-b border-border">
                  <tr>
                    <th className="py-2">Date</th>
                    <th className="py-2">Test</th>
                    <th className="py-2 text-right">Score</th>
                    <th className="py-2">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {selMocks.slice(0, 30).map((m) => (
                    <tr key={m.id}>
                      <td className="py-2 text-xs text-muted-foreground">{new Date(m.submitted_at).toLocaleString()}</td>
                      <td className="py-2 truncate max-w-[200px]">{m.test_name}</td>
                      <td className="py-2 text-right font-semibold tabular-nums">{m.percentage}% ({m.grade})</td>
                      <td className="py-2">
                        {m.submission_type === "auto-violation" ? (
                          <span className="text-destructive text-xs" title={m.violation_reason ?? ""}>auto · {m.violation_reason ?? "violation"}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">normal</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {(() => {
              // Unique practice questions this student has solved (solved=true)
              const solvedMap = new Map<string, { unit: number; solved_at: string }>();
              for (const p of selPractice) {
                if (!p.solved) continue;
                const prev = solvedMap.get(p.question_id);
                if (!prev || new Date(p.attempted_at).getTime() < new Date(prev.solved_at).getTime()) {
                  solvedMap.set(p.question_id, { unit: p.unit, solved_at: p.attempted_at });
                }
              }
              const solvedList = Array.from(solvedMap.entries())
                .map(([qid, meta]) => ({ qid, ...meta, title: getQuestion(qid)?.title ?? null }))
                .sort((a, b) => (a.unit - b.unit) || a.qid.localeCompare(b.qid));
              return (
                <>
                  <h3 className="mt-6 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                    Solved questions ({solvedList.length})
                  </h3>
                  {solvedList.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">No practice questions solved yet.</p>
                  ) : (
                    <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                      {solvedList.map((q) => (
                        <li
                          key={q.qid}
                          className="rounded-md border border-[oklch(0.65_0.16_145)]/30 bg-[oklch(0.65_0.16_145)]/5 px-3 py-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold truncate">
                                {q.title ?? q.qid}
                              </p>
                              <p className="text-[11px] text-muted-foreground font-mono truncate">
                                {q.qid} · Unit {q.unit}
                              </p>
                            </div>
                            <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-[oklch(0.4_0.16_145)]">
                              ✓ solved
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            First solved {new Date(q.solved_at).toLocaleString()}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              );
            })()}

            {selected && <BadgesGrid studentId={selected} title="Student badges" />}

            <h3 className="mt-6 text-sm font-semibold uppercase tracking-widest text-muted-foreground">Recent practice</h3>
            {selPractice.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">None.</p>
            ) : (
              <ul className="mt-2 divide-y divide-border text-sm">
                {selPractice.slice(0, 30).map((p) => (
                  <li key={p.id} className="py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate">{p.question_id}</p>
                      <p className="text-xs text-muted-foreground">Unit {p.unit} · {new Date(p.attempted_at).toLocaleString()}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${
                        p.solved
                          ? "bg-[oklch(0.65_0.16_145)]/15 text-[oklch(0.4_0.16_145)]"
                          : p.passed > 0
                            ? "bg-accent/20 text-accent-foreground"
                            : "bg-destructive/15 text-destructive"
                      }`}
                    >
                      {p.passed}/{p.total}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            </div>
          </>

        )}
      </div>
    </section>
  );
}

function ActivityTab({
  authInfo,
  students,
  profiles,
}: {
  authInfo: StudentAuthInfo[];
  students: StudentRow[];
  profiles: Record<string, { display_name: string | null }>;
}) {
  const [sort, setSort] = useState<"last_sign_in" | "created" | "name">("last_sign_in");
  const [filter, setFilter] = useState("");

  const studentIdSet = useMemo(() => new Set(students.map((s) => s.user_id)), [students]);
  const rows = useMemo(() => {
    const enriched = authInfo
      .filter((a) => studentIdSet.size === 0 || studentIdSet.has(a.user_id))
      .map((a) => ({
        ...a,
        name: profiles[a.user_id]?.display_name || a.email || a.user_id.slice(0, 8),
      }));
    const q = filter.trim().toLowerCase();
    const filtered = q
      ? enriched.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            (r.email ?? "").toLowerCase().includes(q) ||
            r.user_id.toLowerCase().includes(q),
        )
      : enriched;
    return [...filtered].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      const aKey = sort === "created" ? a.created_at : a.last_sign_in_at;
      const bKey = sort === "created" ? b.created_at : b.last_sign_in_at;
      const at = aKey ? new Date(aKey).getTime() : 0;
      const bt = bKey ? new Date(bKey).getTime() : 0;
      return bt - at;
    });
  }, [authInfo, studentIdSet, profiles, filter, sort]);

  const now = Date.now();
  const active24h = rows.filter((r) => r.last_sign_in_at && now - new Date(r.last_sign_in_at).getTime() < 24 * 3600 * 1000).length;
  const active7d = rows.filter((r) => r.last_sign_in_at && now - new Date(r.last_sign_in_at).getTime() < 7 * 24 * 3600 * 1000).length;
  const neverSignedIn = rows.filter((r) => !r.last_sign_in_at).length;
  const newWeek = rows.filter((r) => r.created_at && now - new Date(r.created_at).getTime() < 7 * 24 * 3600 * 1000).length;

  return (
    <section className="mt-6 space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total accounts" value={rows.length} />
        <Stat label="Active in 24h" value={active24h} tone="good" />
        <Stat label="Active in 7 days" value={active7d} tone="good" />
        <Stat label="New in 7 days" value={newWeek} tone="warn" />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-base font-semibold">Student account activity</h2>
            <p className="text-xs text-muted-foreground">
              Created, last sign-in, and last activity (token refresh / logout) timestamps.
              {neverSignedIn > 0 && ` ${neverSignedIn} have never signed in.`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search name or email…"
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            >
              <option value="last_sign_in">Sort: Last sign-in</option>
              <option value="created">Sort: Newest account</option>
              <option value="name">Sort: Name</option>
            </select>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No accounts found.</p>
        ) : (
          <div className="overflow-auto max-h-[640px]">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground border-b border-border sticky top-0 bg-card">
                <tr>
                  <th className="py-2 pr-3">Student</th>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Provider</th>
                  <th className="py-2 pr-3">Created</th>
                  <th className="py-2 pr-3">Last sign-in</th>
                  <th className="py-2 pr-3">Last activity</th>
                  <th className="py-2 pr-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.user_id} className="transition-all duration-200 hover:bg-accent/10 hover:shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--accent)_35%,transparent),0_0_18px_-8px_color-mix(in_oklch,var(--accent)_60%,transparent)] cursor-default">

                    <td className="py-2 pr-3 font-medium">{r.name}</td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground break-all">{r.email ?? "—"}</td>
                    <td className="py-2 pr-3 text-xs">{r.providers.join(", ") || "—"}</td>
                    <td className="py-2 pr-3 text-xs">
                      <div>{fmtDate(r.created_at)}</div>
                      <div className="text-muted-foreground">{fmtRelative(r.created_at)}</div>
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      <div>{fmtDate(r.last_sign_in_at)}</div>
                      <div className="text-muted-foreground">{fmtRelative(r.last_sign_in_at)}</div>
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      <div>{fmtDate(r.updated_at)}</div>
                      <div className="text-muted-foreground">{fmtRelative(r.updated_at)}</div>
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      {r.is_banned ? (
                        <span className="text-destructive font-semibold">Banned</span>
                      ) : !r.email_confirmed_at ? (
                        <span className="text-[oklch(0.6_0.16_85)]">Unverified</span>
                      ) : !r.last_sign_in_at ? (
                        <span className="text-muted-foreground">Never signed in</span>
                      ) : (
                        <span className="text-[oklch(0.4_0.16_145)]">Active</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[11px] text-muted-foreground">
          Note: Supabase doesn't store per-event login/logout logs in the public database. "Last activity" reflects the most recent session refresh or sign-out (whichever is later).
        </p>
      </div>
    </section>
  );
}

function AnnounceTab({ authorId, students }: { authorId: string; students: StudentRow[] }) {

  const [list, setList] = useState<Announcement[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high">("normal");
  const [target, setTarget] = useState<string>("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<string>("");
  const [scheduledTime, setScheduledTime] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setList(await listAnnouncements());
  }
  useEffect(() => {
    void load();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    let iso: string | null = null;
    if (scheduleEnabled) {
      if (!scheduledDate || !scheduledTime) {
        alert("Please pick both a date and a time to schedule this announcement.");
        return;
      }
      const dt = new Date(`${scheduledDate}T${scheduledTime}`);
      if (Number.isNaN(dt.getTime())) {
        alert("Invalid scheduled date or time.");
        return;
      }
      if (dt.getTime() <= Date.now()) {
        alert("Scheduled time must be in the future.");
        return;
      }
      iso = dt.toISOString();
    }
    setBusy(true);
    try {
      await createAnnouncement({
        authorId,
        title: title.trim(),
        body: body.trim(),
        priority,
        targetUserId: target || null,
        scheduledAt: iso,
      });
      void logAdminActionClient({
        actionType: iso ? "announcement.scheduled" : "announcement.created",
        description: iso
          ? `Scheduled announcement: ${title.trim()}`
          : `Created announcement: ${title.trim()}`,
        moduleName: "announcement",
        targetTitle: title.trim(),
        relatedStudentId: target || null,
        newValue: { priority, target_user_id: target || null, scheduled_at: iso },
      });
      setTitle("");
      setBody("");
      setPriority("normal");
      setTarget("");
      setScheduleEnabled(false);
      setScheduledDate("");
      setScheduledTime("");
      await load();
    } catch (err) {
      alert("Failed to send: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  }


  async function remove(id: string) {
    if (!confirm("Delete this announcement?")) return;
    const removed = list.find((a) => a.id === id);
    await deleteAnnouncement(id);
    void logAdminActionClient({
      actionType: "announcement.deleted",
      description: `Deleted announcement: ${removed?.title ?? id}`,
      moduleName: "announcement",
      targetId: id,
      targetTitle: removed?.title ?? null,
      oldValue: removed ?? null,
    });
    await load();
  }

  return (
    <section className="mt-6 grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold">Send a new announcement</h2>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Mock test 2 scheduled tomorrow"
              required
              maxLength={150}
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Message</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Write your announcement here. Markdown not supported — plain text only."
              required
              maxLength={2000}
            />
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Priority</span>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as typeof priority)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High (alert)</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Recipient</span>
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">All students (broadcast)</option>
                {students.map((s) => (
                  <option key={s.user_id} value={s.user_id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="rounded-md border border-border bg-background/40 p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={scheduleEnabled}
                onChange={(e) => setScheduleEnabled(e.target.checked)}
                className="h-4 w-4"
              />
              ⏰ Schedule for later
            </label>
            {scheduleEnabled && (
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Date</label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    min={new Date().toISOString().slice(0, 10)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Time</label>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    required
                  />
                </div>
                <p className="sm:col-span-2 mt-0 text-[11px] text-muted-foreground">
                  Students will only see this announcement once the scheduled time arrives ({Intl.DateTimeFormat().resolvedOptions().timeZone}).
                </p>
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            style={{ backgroundImage: "var(--gradient-sunrise)" }}
          >
            {busy ? "Sending…" : scheduleEnabled ? "Schedule announcement" : "Send announcement"}
          </button>
        </form>
      </div>


      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold">Recent announcements</h2>
        {list.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nothing sent yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border max-h-[520px] overflow-auto">
            {list.map((n) => (
              <li key={n.id} className="py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold truncate">{n.title}</p>
                      {n.scheduled_at && new Date(n.scheduled_at).getTime() > Date.now() && (
                        <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-accent">
                          ⏰ Scheduled
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {n.scheduled_at && new Date(n.scheduled_at).getTime() > Date.now()
                        ? `Goes live ${new Date(n.scheduled_at).toLocaleString()}`
                        : new Date(n.scheduled_at ?? n.created_at).toLocaleString()}
                      {" · "}
                      {n.target_user_id ? "direct" : "broadcast"} · {n.priority}
                    </p>
                  </div>

                  {n.author_id === authorId && (
                    <button
                      onClick={() => remove(n.id)}
                      className="text-xs text-destructive underline shrink-0"
                    >
                      Delete
                    </button>
                  )}
                </div>
                <p className="mt-2 text-sm text-foreground/90 whitespace-pre-wrap line-clamp-4">{n.body}</p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          <Link to="/notifications" className="underline">
            See student view →
          </Link>
        </p>
      </div>
    </section>
  );
}

type ReportRow = {
  id: string;
  user_id: string;
  student_name: string | null;
  student_email: string | null;
  roll_number: string | null;
  problem_type: string;
  related_section: string;
  subject: string;
  description: string;
  priority: string;
  question_id: string | null;
  test_id: string | null;
  page_url: string | null;
  browser_info: string | null;
  screenshot_url: string | null;
  status: string;
  admin_remarks: string | null;
  admin_response: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

const STATUS_TONES: Record<string, string> = {
  Open: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  "In Progress": "bg-sky-500/15 text-sky-600 border-sky-500/30",
  Resolved: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  Rejected: "bg-destructive/15 text-destructive border-destructive/30",
};

const PRIORITY_TONES: Record<string, string> = {
  Low: "text-muted-foreground",
  Medium: "text-sky-600",
  High: "text-amber-600",
  Urgent: "text-destructive font-semibold",
};

function ReportsTab() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<ReportRow | null>(null);
  const [shotUrl, setShotUrl] = useState<string | null>(null);
  const [remarks, setRemarks] = useState("");
  const [response, setResponse] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data, error } = await supabase
        .from("problem_reports")
        .select("*")
        .order("created_at", { ascending: false });
      if (!mounted) return;
      if (!error && data) setRows(data as ReportRow[]);
      setLoading(false);
    }
    load();
    const channel = supabase
      .channel("problem_reports_admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "problem_reports" }, load)
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!selected) {
      setShotUrl(null);
      return;
    }
    setRemarks(selected.admin_remarks ?? "");
    setResponse(selected.admin_response ?? "");
    if (selected.screenshot_url) {
      getScreenshotSignedUrl(selected.screenshot_url).then(setShotUrl);
    } else {
      setShotUrl(null);
    }
  }, [selected]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (typeFilter !== "all" && r.problem_type !== typeFilter) return false;
      if (priorityFilter !== "all" && r.priority !== priorityFilter) return false;
      if (!term) return true;
      return (
        r.subject.toLowerCase().includes(term) ||
        r.description.toLowerCase().includes(term) ||
        (r.student_email ?? "").toLowerCase().includes(term) ||
        (r.student_name ?? "").toLowerCase().includes(term) ||
        (r.question_id ?? "").toLowerCase().includes(term) ||
        (r.test_id ?? "").toLowerCase().includes(term)
      );
    });
  }, [rows, statusFilter, typeFilter, priorityFilter, q]);

  const counts = useMemo(() => {
    const c = { Open: 0, "In Progress": 0, Resolved: 0, Rejected: 0 } as Record<string, number>;
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);

  const types = useMemo(() => Array.from(new Set(rows.map((r) => r.problem_type))).sort(), [rows]);

  async function updateStatus(status: string) {
    if (!selected) return;
    setSaving(true);
    const patch: {
      status: string;
      admin_remarks: string | null;
      admin_response: string | null;
      resolved_at?: string;
    } = {
      status,
      admin_remarks: remarks || null,
      admin_response: response || null,
    };
    if (status === "Resolved") patch.resolved_at = new Date().toISOString();
    const { error } = await supabase.from("problem_reports").update(patch).eq("id", selected.id);
    setSaving(false);
    if (!error) setSelected({ ...selected, ...patch } as ReportRow);
  }

  async function saveNotes() {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase
      .from("problem_reports")
      .update({ admin_remarks: remarks || null, admin_response: response || null })
      .eq("id", selected.id);
    setSaving(false);
    if (!error) setSelected({ ...selected, admin_remarks: remarks, admin_response: response });
  }

  async function deleteReport() {
    if (!selected) return;
    if (!confirm("Delete this report permanently?")) return;
    const { error } = await supabase.from("problem_reports").delete().eq("id", selected.id);
    if (!error) {
      setRows((rs) => rs.filter((r) => r.id !== selected.id));
      setSelected(null);
    }
  }

  if (loading) return <p className="mt-6 text-sm text-muted-foreground">Loading reports…</p>;

  return (
    <section className="mt-6 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Open" value={counts.Open ?? 0} tone="warn" />
        <Stat label="In Progress" value={counts["In Progress"] ?? 0} />
        <Stat label="Resolved" value={counts.Resolved ?? 0} tone="good" />
        <Stat label="Rejected" value={counts.Rejected ?? 0} tone="bad" />
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search subject, email, question/test id…"
            className="flex-1 min-w-[220px] rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          >
            <option value="all">All status</option>
            {["Open", "In Progress", "Resolved", "Rejected"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          >
            <option value="all">All types</option>
            {types.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          >
            <option value="all">All priority</option>
            {["Low", "Medium", "High", "Urgent"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
        <div className="rounded-2xl border border-border bg-card shadow-sm max-h-[70vh] overflow-auto">
          {filtered.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No reports match your filters.</p>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => setSelected(r)}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 ${
                      selected?.id === r.id
                        ? "bg-accent/15 ring-1 ring-accent/40 shadow-[0_0_18px_-6px_color-mix(in_oklch,var(--accent)_55%,transparent)]"
                        : "hover:bg-accent/10 hover:ring-1 hover:ring-accent/30 hover:shadow-[0_0_16px_-6px_color-mix(in_oklch,var(--accent)_50%,transparent)]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold truncate">{r.subject}</p>
                      <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] ${STATUS_TONES[r.status] ?? ""}`}>
                        {r.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {r.problem_type} · <span className={PRIORITY_TONES[r.priority] ?? ""}>{r.priority}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {r.student_name || r.student_email || r.user_id.slice(0, 8)} · {fmtRelative(r.created_at)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          {!selected ? (
            <p className="text-sm text-muted-foreground">Select a report to view details.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="text-xl font-bold">{selected.subject}</h3>
                  <p className="text-xs text-muted-foreground">Report ID: {selected.id}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded border px-2 py-0.5 text-xs ${STATUS_TONES[selected.status] ?? ""}`}>
                    {selected.status}
                  </span>
                  <span className={`text-xs ${PRIORITY_TONES[selected.priority] ?? ""}`}>{selected.priority}</span>
                </div>
              </div>

              <dl className="grid gap-2 sm:grid-cols-2 text-sm">
                <InfoCell label="Student" value={selected.student_name} />
                <InfoCell label="Email" value={selected.student_email} />
                <InfoCell label="Roll number" value={selected.roll_number} />
                <InfoCell label="Problem type" value={selected.problem_type} />
                <InfoCell label="Section" value={selected.related_section} />
                <InfoCell label="Submitted" value={fmtDate(selected.created_at)} />
                <InfoCell label="Question ID" value={selected.question_id} />
                <InfoCell label="Test ID" value={selected.test_id} />
                <InfoCell label="Page URL" value={selected.page_url} />
                <InfoCell label="Browser" value={selected.browser_info} />
              </dl>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                  Description
                </h4>
                <p className="whitespace-pre-wrap rounded-md border border-border bg-background/40 p-3 text-sm">
                  {selected.description}
                </p>
              </div>

              {selected.question_id && (
                <Link
                  to="/practice/$qid"
                  params={{ qid: selected.question_id }}
                  className="inline-flex rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary"
                >
                  Open related question →
                </Link>
              )}

              {shotUrl && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                    Screenshot
                  </h4>
                  <a href={shotUrl} target="_blank" rel="noreferrer">
                    <img
                      src={shotUrl}
                      alt="Screenshot from user"
                      className="max-h-72 rounded-md border border-border"
                    />
                  </a>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block font-semibold">Admin remarks (internal)</span>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={3}
                    className="w-full rounded-md border border-input bg-background px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-semibold">Response to student</span>
                  <textarea
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    rows={3}
                    className="w-full rounded-md border border-input bg-background px-3 py-2"
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => updateStatus("Open")}
                  disabled={saving}
                  className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary"
                >
                  Mark Open
                </button>
                <button
                  onClick={() => updateStatus("In Progress")}
                  disabled={saving}
                  className="rounded-md bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-600"
                >
                  In Progress
                </button>
                <button
                  onClick={() => updateStatus("Resolved")}
                  disabled={saving}
                  className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600"
                >
                  Resolved
                </button>
                <button
                  onClick={() => updateStatus("Rejected")}
                  disabled={saving}
                  className="rounded-md bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground hover:bg-destructive/80"
                >
                  Reject
                </button>
                <button
                  onClick={saveNotes}
                  disabled={saving}
                  className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary"
                >
                  Save notes
                </button>
                <button
                  onClick={deleteReport}
                  className="ml-auto rounded-md border border-destructive/40 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10"
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

type ReviewRow = {
  id: string;
  user_id: string;
  student_name: string | null;
  student_email: string | null;
  roll_number: string | null;
  rating: number;
  review_text: string | null;
  category: string | null;
  quick_reaction: string | null;
  page_url: string | null;
  status: string;
  is_important: boolean;
  created_at: string;
};

function ReviewsTab() {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ReviewRow | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data } = await supabase
        .from("user_reviews")
        .select("*")
        .order("created_at", { ascending: false });
      if (!mounted) return;
      if (data) setRows(data as ReviewRow[]);
      setLoading(false);
    }
    load();
    const ch = supabase
      .channel("user_reviews_admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_reviews" }, load)
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, []);

  const cats = useMemo(() => Array.from(new Set(rows.map((r) => r.category).filter(Boolean))) as string[], [rows]);

  const filtered = rows.filter((r) => {
    if (ratingFilter !== "all" && String(r.rating) !== ratingFilter) return false;
    if (catFilter !== "all" && r.category !== catFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !(r.student_name || "").toLowerCase().includes(q) &&
        !(r.student_email || "").toLowerCase().includes(q) &&
        !(r.review_text || "").toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  const unread = rows.filter((r) => r.status === "unread").length;
  const avg = rows.length ? (rows.reduce((s, r) => s + r.rating, 0) / rows.length).toFixed(2) : "—";

  async function updateStatus(id: string, status: string) {
    await supabase.from("user_reviews").update({ status }).eq("id", id);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  }
  async function toggleImportant(id: string, val: boolean) {
    await supabase.from("user_reviews").update({ is_important: val }).eq("id", id);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, is_important: val } : r)));
  }
  async function del(id: string) {
    if (!confirm("Delete this review?")) return;
    await supabase.from("user_reviews").delete().eq("id", id);
    setRows((prev) => prev.filter((r) => r.id !== id));
    setSelected(null);
  }

  function exportCsv() {
    const headers = ["date", "name", "email", "roll", "rating", "category", "reaction", "text", "status"];
    const csv = [
      headers.join(","),
      ...filtered.map((r) =>
        [
          new Date(r.created_at).toISOString(),
          r.student_name || "",
          r.student_email || "",
          r.roll_number || "",
          r.rating,
          r.category || "",
          r.quick_reaction || "",
          (r.review_text || "").replace(/"/g, '""'),
          r.status,
        ]
          .map((v) => `"${String(v).replace(/\n/g, " ")}"`)
          .join(","),
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pykidda-reviews-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="mt-6 space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Total reviews" value={rows.length} />
        <Stat label="Unread" value={unread} tone={unread > 0 ? "warn" : "default"} />
        <Stat label="Average rating" value={avg} tone="good" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, or text…"
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
        />
        <select
          value={ratingFilter}
          onChange={(e) => setRatingFilter(e.target.value)}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        >
          <option value="all">All ratings</option>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n} ★
            </option>
          ))}
        </select>
        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        >
          <option value="all">All categories</option>
          {cats.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          onClick={exportCsv}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-secondary"
        >
          Export CSV
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No reviews yet.</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                setSelected(r);
                if (r.status === "unread") updateStatus(r.id, "read");
              }}
              className={`text-left rounded-xl border p-4 transition hover:border-accent ${
                r.status === "unread" ? "border-accent/60 bg-accent/5" : "border-border bg-card"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold">{r.student_name || "Student"}</div>
                <div className="text-amber-500 text-sm">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</div>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {r.student_email} · {r.category || "—"} · {fmtRelative(r.created_at)}
              </div>
              {r.review_text && (
                <p className="mt-2 text-sm line-clamp-2 text-foreground/90">{r.review_text}</p>
              )}
              <div className="mt-2 flex gap-1.5 text-[11px]">
                {r.quick_reaction && (
                  <span className="rounded-full bg-secondary px-2 py-0.5">{r.quick_reaction}</span>
                )}
                {r.is_important && (
                  <span className="rounded-full bg-amber-500/20 text-amber-700 px-2 py-0.5">Important</span>
                )}
                <span className="rounded-full bg-muted px-2 py-0.5">{r.status}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{selected.student_name || "Student"}</h3>
              <div className="text-amber-500">{"★".repeat(selected.rating)}{"☆".repeat(5 - selected.rating)}</div>
            </div>
            <p className="text-xs text-muted-foreground">
              {selected.student_email} · {selected.roll_number || "—"} · {fmtDate(selected.created_at)}
            </p>
            <div className="mt-3 text-sm space-y-1">
              <div><span className="text-muted-foreground">Category:</span> {selected.category || "—"}</div>
              {selected.quick_reaction && (
                <div><span className="text-muted-foreground">Reaction:</span> {selected.quick_reaction}</div>
              )}
              {selected.page_url && (
                <div><span className="text-muted-foreground">Page:</span> {selected.page_url}</div>
              )}
            </div>
            {selected.review_text && (
              <div className="mt-3 rounded-md border border-border bg-background p-3 text-sm whitespace-pre-wrap">
                {selected.review_text}
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => toggleImportant(selected.id, !selected.is_important)}
                className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary"
              >
                {selected.is_important ? "Unmark important" : "Mark important"}
              </button>
              <button
                onClick={() => updateStatus(selected.id, selected.status === "unread" ? "read" : "unread")}
                className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary"
              >
                Mark {selected.status === "unread" ? "read" : "unread"}
              </button>
              <button
                onClick={() => updateStatus(selected.id, "archived")}
                className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary"
              >
                Archive
              </button>
              <button
                onClick={() => del(selected.id)}
                className="rounded-md border border-destructive bg-destructive/10 text-destructive px-3 py-1.5 text-sm hover:bg-destructive/20"
              >
                Delete
              </button>
              <button
                onClick={() => setSelected(null)}
                className="ml-auto rounded-md px-3 py-1.5 text-sm hover:bg-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

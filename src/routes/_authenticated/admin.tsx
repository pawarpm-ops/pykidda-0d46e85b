import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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


export const Route = createFileRoute("/_authenticated/admin")({
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

function AdminPage() {
  const isAdmin = useIsAdmin();
  const [tab, setTab] = useState<"overview" | "students" | "activity" | "announce">("overview");
  const [mocks, setMocks] = useState<MockRow[]>([]);
  const [practice, setPractice] = useState<PracticeRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileInfo>>({});
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [authInfo, setAuthInfo] = useState<StudentAuthInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorId, setAuthorId] = useState<string | null>(null);
  const fetchAuthInfo = useServerFn(listStudentAuthInfo);

  useEffect(() => {
    if (isAdmin === null) return;
    if (isAdmin === false) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      const { data: u } = await supabase.auth.getUser();
      setAuthorId(u.user?.id ?? null);

      const [m, p, pr, sr, ai] = await Promise.all([
        supabase.from("mock_results").select("*").order("submitted_at", { ascending: false }).limit(1000),
        supabase.from("practice_attempts").select("*").order("attempted_at", { ascending: false }).limit(2000),
        supabase.from("profiles").select("id, display_name, full_name, contact_number, college_name, age, gender, birth_date, onboarded"),
        supabase.from("user_roles").select("user_id").eq("role", "student"),
        fetchAuthInfo().catch((e) => { console.error("auth info", e); return [] as StudentAuthInfo[]; }),
      ]);
      setMocks((m.data ?? []) as MockRow[]);
      setPractice((p.data ?? []) as PracticeRow[]);
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
        };
      }
      setProfiles(pmap);
      setStudentIds(((sr.data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id));
      setAuthInfo(ai);
      setLoading(false);
    })();
  }, [isAdmin, fetchAuthInfo]);


  const students = useMemo<StudentRow[]>(() => {
    const map = new Map<string, StudentRow>();
    for (const uid of studentIds) {
      map.set(uid, {
        user_id: uid,
        name: profiles[uid]?.display_name || uid.slice(0, 8),
        mocks: 0,
        bestPct: 0,
        avgPct: 0,
        practiceAttempts: 0,
        practiceSolved: 0,
        violations: 0,
      });
    }
    for (const m of mocks) {
      const cur = map.get(m.user_id) ?? {
        user_id: m.user_id,
        name: m.student_name || profiles[m.user_id]?.display_name || m.user_id.slice(0, 8),
        mocks: 0,
        bestPct: 0,
        avgPct: 0,
        practiceAttempts: 0,
        practiceSolved: 0,
        violations: 0,
      };
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
      const cur =
        map.get(p.user_id) ??
        {
          user_id: p.user_id,
          name: profiles[p.user_id]?.display_name || p.user_id.slice(0, 8),
          mocks: 0,
          bestPct: 0,
          avgPct: 0,
          practiceAttempts: 0,
          practiceSolved: 0,
          violations: 0,
        };
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
    return Array.from(map.values()).sort((a, b) => b.avgPct - a.avgPct);
  }, [mocks, practice, profiles, studentIds]);

  if (isAdmin === null || loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <main className="mx-auto max-w-7xl px-6 py-10">Loading admin dashboard…</main>
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
  const studentChart = students.slice(0, 20).map((s) => ({ name: s.name, avg: s.avgPct, best: s.bestPct }));

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
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-widest text-accent font-semibold">Admin</p>
            <h1 className="mt-1 text-3xl md:text-4xl font-bold tracking-tight">Teacher dashboard</h1>
            <p className="mt-1 text-muted-foreground">Track every student's progress and send announcements.</p>
          </div>
          <div className="flex gap-1 rounded-md border border-border bg-card p-1 text-sm flex-wrap">
            {(["overview", "students", "activity", "announce"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded transition ${
                  tab === t ? "bg-accent text-accent-foreground font-semibold" : "hover:bg-secondary"
                }`}
              >
                {t === "overview" ? "Overview" : t === "students" ? "Students" : t === "activity" ? "Activity logs" : "Announcements"}
              </button>
            ))}
          </div>

        </div>

        {tab === "overview" && (
          <>
            <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
              <ChartCard title="Top students (avg vs best %)">
                {studentChart.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No mock test data yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={studentChart} margin={{ top: 5, right: 10, left: -10, bottom: 40 }}>
                      <CartesianGrid stroke="oklch(0.85 0.01 250)" strokeDasharray="3 3" opacity={0.4} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="avg" fill={C.primary} name="Avg %" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="best" fill={C.accent} name="Best %" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              <ChartCard title="Score distribution">
                {allPcts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No data.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={bands} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100}>
                        {bands.map((b, i) => (
                          <Cell key={i} fill={b.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              <ChartCard title="Unit-wise average performance">
                {unitData.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No practice data.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={unitData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid stroke="oklch(0.85 0.01 250)" strokeDasharray="3 3" opacity={0.4} />
                      <XAxis dataKey="unit" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(v: number) => [`${v}%`, "Avg"]} />
                      <Bar dataKey="avgPct" fill={C.teal} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

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
                <ChartCard title="Violation reasons (auto-submitted tests)">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={violationData} layout="vertical" margin={{ top: 5, right: 16, left: 80, bottom: 0 }}>
                      <CartesianGrid stroke="oklch(0.85 0.01 250)" strokeDasharray="3 3" opacity={0.4} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                      <YAxis type="category" dataKey="reason" tick={{ fontSize: 12 }} width={200} />
                      <Tooltip />
                      <Bar dataKey="count" fill={C.bad} radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </section>
            )}
          </>
        )}

        {tab === "students" && (
          <StudentsTab students={students} mocks={mocks} practice={practice} authInfo={authInfo} profiles={profiles} />
        )}

        {tab === "activity" && (
          <ActivityTab authInfo={authInfo} students={students} profiles={profiles} />
        )}

        {tab === "announce" && authorId && (
          <AnnounceTab authorId={authorId} students={students} />
        )}

      </main>
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
  const selStudent = students.find((s) => s.user_id === selected);
  const selMocks = mocks.filter((m) => m.user_id === selected);
  const selPractice = practice.filter((p) => p.user_id === selected);
  const authMap = useMemo(() => {
    const m = new Map<string, StudentAuthInfo>();
    for (const a of authInfo) m.set(a.user_id, a);
    return m;
  }, [authInfo]);
  const selAuth = selected ? authMap.get(selected) : undefined;


  return (
    <section className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <p className="text-sm font-semibold mb-2">All students ({students.length})</p>
        {students.length === 0 ? (
          <p className="text-sm text-muted-foreground">No student activity yet.</p>
        ) : (
          <ul className="divide-y divide-border max-h-[600px] overflow-auto">
            {students.map((s) => (
              <li key={s.user_id}>
                <button
                  onClick={() => setSelected(s.user_id)}
                  className={`w-full text-left py-2.5 px-2 rounded transition ${
                    selected === s.user_id ? "bg-accent/10" : "hover:bg-secondary"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium truncate">{s.name}</p>
                    <span className="text-xs tabular-nums text-muted-foreground">{s.avgPct}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {s.mocks} mocks · {s.practiceSolved} solved · {s.violations} viol.
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
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-xl font-bold">{selStudent.name}</h2>
                <p className="text-xs text-muted-foreground">User ID {selStudent.user_id}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
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

            <h3 className="mt-6 text-sm font-semibold uppercase tracking-widest text-muted-foreground">Account & activity</h3>
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
                  <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">Last sign-in</dt>
                  <dd className="font-medium">
                    {fmtDate(selAuth.last_sign_in_at)}
                    <span className="ml-2 text-xs text-muted-foreground">({fmtRelative(selAuth.last_sign_in_at)})</span>
                  </dd>
                </div>
                <div className="rounded-md border border-border bg-background/40 px-3 py-2">
                  <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">Last activity (token refresh / logout)</dt>
                  <dd className="font-medium">
                    {fmtDate(selAuth.updated_at)}
                    <span className="ml-2 text-xs text-muted-foreground">({fmtRelative(selAuth.updated_at)})</span>
                  </dd>
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
                  <tr key={r.user_id}>
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
    setBusy(true);
    try {
      await createAnnouncement({
        authorId,
        title: title.trim(),
        body: body.trim(),
        priority,
        targetUserId: target || null,
      });
      setTitle("");
      setBody("");
      setPriority("normal");
      setTarget("");
      await load();
    } catch (err) {
      alert("Failed to send: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this announcement?")) return;
    await deleteAnnouncement(id);
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
          <button
            type="submit"
            disabled={busy}
            className="rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            style={{ backgroundImage: "var(--gradient-sunrise)" }}
          >
            {busy ? "Sending…" : "Send announcement"}
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
                    <p className="font-semibold truncate">{n.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(n.created_at).toLocaleString()} ·{" "}
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

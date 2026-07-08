import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { fetchPublicProfile, type PublicProfilePayload } from "@/lib/publicProfile";

const publicProfileQuery = (publicId: string) =>
  queryOptions({
    queryKey: ["public-profile", publicId],
    queryFn: async () => {
      const data = await fetchPublicProfile(publicId);
      if (!data) throw notFound();
      return data;
    },
    staleTime: 60_000,
  });

export const Route = createFileRoute("/u/$publicId")({
  ssr: false,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(publicProfileQuery(params.publicId)),
  head: () => ({
    meta: [
      { title: "Public learning profile · PY Kidda" },
      {
        name: "description",
        content:
          "A safe, public snapshot of a student's Python learning journey on PY Kidda — no personal info, just progress.",
      },
      { property: "og:title", content: "Python learning profile · PY Kidda" },
      {
        property: "og:description",
        content: "Scan the QR to see this student's Python learning card.",
      },
    ],
  }),
  component: PublicProfilePage,
  notFoundComponent: () => (
    <UnavailableShell
      title="This public profile is not available"
      message="The student may have turned their public QR profile off, or the link is incorrect."
    />
  ),
  errorComponent: () => (
    <UnavailableShell
      title="Something went wrong"
      message="We couldn't load this public profile. Try again in a moment."
    />
  ),
});

function PublicProfilePage() {
  const { publicId } = Route.useParams();
  const { data } = useSuspenseQuery(publicProfileQuery(publicId));
  return <PublicProfileView profile={data} />;
}

function UnavailableShell({ title, message }: { title: string; message: string }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-md px-6 py-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-2xl">🐍</div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-2 text-muted-foreground">{message}</p>
        <Link
          to="/"
          className="mt-6 inline-block rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)]"
          style={{ backgroundImage: "var(--gradient-sunrise)" }}
        >
          Visit PY Kidda
        </Link>
      </main>
    </div>
  );
}

function StatTile({ label, value, emoji }: { label: string; value: string | number; emoji?: string }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 backdrop-blur-sm">
      <div className="text-[10px] font-bold uppercase tracking-widest text-white/60">{label}</div>
      <div className="mt-1 flex items-baseline gap-1 text-2xl font-black text-white">
        {emoji && <span className="text-xl">{emoji}</span>}
        <span className="tabular-nums">{value}</span>
      </div>
    </div>
  );
}

const BADGE_META: Array<{
  key: "streak_7" | "streak_30" | "solver_10" | "solver_25" | "mock_ace";
  label: string;
  emoji: string;
  desc: string;
}> = [
  { key: "streak_7", label: "Week streaker", emoji: "🔥", desc: "7-day streak" },
  { key: "streak_30", label: "Month master", emoji: "🌟", desc: "30-day streak" },
  { key: "solver_10", label: "Getting warm", emoji: "💡", desc: "10 problems solved" },
  { key: "solver_25", label: "Problem crusher", emoji: "🚀", desc: "25 problems solved" },
  { key: "mock_ace", label: "Mock ace", emoji: "🏆", desc: "80%+ on a mock test" },
];

function PublicProfileView({ profile }: { profile: PublicProfilePayload }) {
  const initial = (profile.display_name || "?").trim().charAt(0).toUpperCase();
  const joined = new Date(profile.joined_at);
  const badgesEarned = profile.badges ? BADGE_META.filter((b) => profile.badges![b.key]) : [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        <div className="mb-4 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-accent"
          >
            🐍 PY Kidda
          </Link>
          <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            🛡️ Safe public view
          </span>
        </div>

        {/* Hero card */}
        <section
          className="relative overflow-hidden rounded-3xl border border-border p-6 text-white shadow-[var(--shadow-warm)] sm:p-8"
          style={{
            backgroundImage:
              "radial-gradient(120% 90% at 100% 0%, oklch(0.72 0.16 55 / 0.4), transparent 60%), radial-gradient(90% 80% at 0% 100%, oklch(0.55 0.14 210 / 0.5), transparent 60%), linear-gradient(135deg, oklch(0.22 0.06 260), oklch(0.32 0.09 240))",
          }}
        >
          <div className="flex flex-wrap items-center gap-5">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt={profile.display_name}
                className="h-24 w-24 rounded-full border-4 border-white/30 object-cover shadow-lg"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <span
                className="inline-flex h-24 w-24 items-center justify-center rounded-full border-4 border-white/30 text-4xl font-black text-white shadow-lg"
                style={{ backgroundImage: "var(--gradient-sunrise)" }}
              >
                {initial}
              </span>
            )}
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">
                Python learner
              </p>
              <h1 className="mt-1 text-3xl font-black leading-tight sm:text-4xl">
                {profile.display_name}
              </h1>
              {profile.college_name && (
                <p className="mt-1 text-sm text-white/80">🎓 {profile.college_name}</p>
              )}
              <p className="mt-1 text-xs text-white/60">
                Learning on PY Kidda since {joined.toLocaleDateString(undefined, { month: "short", year: "numeric" })}
              </p>
            </div>
          </div>

          {profile.bio && (
            <p className="mt-5 max-w-prose text-sm leading-relaxed text-white/85">
              "{profile.bio}"
            </p>
          )}

          {(profile.current_streak !== undefined ||
            profile.leaderboard_rank != null ||
            profile.practice_solved !== undefined) && (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {profile.current_streak !== undefined && (
                <StatTile label="Current streak" value={profile.current_streak} emoji="🔥" />
              )}
              {profile.longest_streak !== undefined && (
                <StatTile label="Longest streak" value={profile.longest_streak} emoji="⚡" />
              )}
              {profile.leaderboard_rank != null && (
                <StatTile label="Leaderboard" value={`#${profile.leaderboard_rank}`} emoji="🏆" />
              )}
              {profile.practice_solved !== undefined && (
                <StatTile label="Problems solved" value={profile.practice_solved} emoji="✅" />
              )}
              {profile.mocks_taken !== undefined && profile.mocks_taken > 0 && (
                <StatTile label="Mock tests" value={profile.mocks_taken} emoji="📝" />
              )}
              {profile.mock_best !== undefined && profile.mock_best > 0 && (
                <StatTile label="Best mock" value={`${profile.mock_best}%`} emoji="🎯" />
              )}
            </div>
          )}

          <div className="pointer-events-none absolute -bottom-6 -right-4 text-7xl opacity-25" aria-hidden>
            🐍
          </div>
        </section>

        {/* Units */}
        {profile.units_completed && profile.units_completed.length > 0 && (
          <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-warm)]">
            <h2 className="text-sm font-bold uppercase tracking-widest text-accent">
              Completed Python units
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {profile.units_completed.map((u) => (
                <span
                  key={u}
                  className="rounded-full border border-border bg-background px-3 py-1 text-sm font-semibold"
                >
                  Unit {u}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Badges */}
        {profile.badges && badgesEarned.length > 0 && (
          <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-warm)]">
            <h2 className="text-sm font-bold uppercase tracking-widest text-accent">
              Achievement badges
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {badgesEarned.map((b) => (
                <div
                  key={b.key}
                  className="flex items-center gap-3 rounded-xl border border-border bg-background/60 p-3"
                >
                  <span className="text-3xl">{b.emoji}</span>
                  <div>
                    <p className="text-sm font-bold leading-tight">{b.label}</p>
                    <p className="text-xs text-muted-foreground">{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-6 rounded-2xl border border-border bg-card p-5 text-center shadow-[var(--shadow-warm)]">
          <p className="text-sm text-muted-foreground">
            Learn, practice, and level up your Python skills with PY Kidda.
          </p>
          <Link
            to="/"
            className="mt-3 inline-block rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)]"
            style={{ backgroundImage: "var(--gradient-sunrise)" }}
          >
            Start your own Python journey →
          </Link>
        </section>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          This is a public safe view. No email, phone, birth date, or personal info is shared.
        </p>
      </main>
    </div>
  );
}

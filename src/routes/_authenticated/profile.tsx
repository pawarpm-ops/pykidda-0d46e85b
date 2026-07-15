import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { User, Flame, Award, FileText, GraduationCap, QrCode, type LucideIcon } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { StreakCard } from "@/components/StreakCard";
import { ProfileQrCard } from "@/components/ProfileQrCard";
import { BadgesGrid } from "@/components/BadgesGrid";
import { YourNextBadges } from "@/components/YourNextBadges";
import { DEFAULT_PUBLIC_SETTINGS, type PublicProfileSettings } from "@/lib/publicProfile";
import { supabase } from "@/integrations/supabase/client";
import { restartTutorial } from "@/components/OnboardingTutorial";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your profile · PY Kidda" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilePage,
  ssr: false,
});

const profileSchema = z.object({
  display_name: z.string().trim().max(60, "Max 60 characters").optional().or(z.literal("")),
  bio: z.string().trim().max(280, "Max 280 characters").optional().or(z.literal("")),
  avatar_url: z
    .string()
    .trim()
    .max(2000, "Avatar URL too long")
    .url("Must be a valid URL")
    .optional()
    .or(z.literal("")),
});

const AVATAR_MAX_BYTES = 3 * 1024 * 1024; // 3MB
const AVATAR_ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const AVATAR_SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10; // ~10 years

function ProfilePage() {
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [presenceStatus, setPresenceStatus] = useState<"active" | "idle" | "offline">("active");
  const [savingStatus, setSavingStatus] = useState(false);

  const [publicId, setPublicId] = useState<string | null>(null);
  const [studentUniqueId, setStudentUniqueId] = useState<string | null>(null);
  const [qrEnabled, setQrEnabled] = useState<boolean>(true);
  const [publicSettings, setPublicSettings] = useState<PublicProfileSettings>(DEFAULT_PUBLIC_SETTINGS);
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  type TabKey = "profile" | "streak" | "badges" | "qr" | "reports" | "tutorial";
  const [activeTab, setActiveTab] = useState<TabKey>("profile");


  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setEmail(u.user.email ?? null);
      setUserId(u.user.id);
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, bio, avatar_url, public_profile_id, student_unique_id, qr_enabled, public_profile_settings, presence_status")
        .eq("id", u.user.id)
        .maybeSingle();
      if (error) {
        setMsg({ kind: "err", text: error.message });
      } else if (data) {
        setDisplayName(data.display_name ?? "");
        setBio(data.bio ?? "");
        setAvatarUrl(data.avatar_url ?? "");
        setPublicId(data.public_profile_id ?? null);
        setStudentUniqueId((data as { student_unique_id?: string | null }).student_unique_id ?? null);
        setQrEnabled(data.qr_enabled ?? true);
        setPublicSettings({
          ...DEFAULT_PUBLIC_SETTINGS,
          ...((data.public_profile_settings as Partial<PublicProfileSettings>) ?? {}),
        });
        const ps = (data as { presence_status?: string }).presence_status;
        if (ps === "active" || ps === "idle" || ps === "offline") setPresenceStatus(ps);
      }
      setLoading(false);
    })();
  }, []);

  async function savePrivacy(nextEnabled: boolean, nextSettings: PublicProfileSettings) {
    if (!userId) return;
    setSavingPrivacy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ qr_enabled: nextEnabled, public_profile_settings: nextSettings })
      .eq("id", userId);
    setSavingPrivacy(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Public profile settings updated");
    }
  }

  function toggleSetting(key: keyof PublicProfileSettings) {
    const next = { ...publicSettings, [key]: !publicSettings[key] };
    setPublicSettings(next);
    void savePrivacy(qrEnabled, next);
  }

  async function updatePresenceStatus(next: "active" | "idle" | "offline") {
    if (!userId) return;
    const prev = presenceStatus;
    setPresenceStatus(next);
    setSavingStatus(true);
    const { error } = await supabase
      .from("profiles")
      .update({ presence_status: next })
      .eq("id", userId);
    setSavingStatus(false);
    if (error) {
      setPresenceStatus(prev);
      toast.error(error.message);
    } else {
      toast.success(`Status set to ${next}`);
    }
  }



  function toggleQrEnabled() {
    const next = !qrEnabled;
    setQrEnabled(next);
    void savePrivacy(next, publicSettings);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setMsg(null);

    const parsed = profileSchema.safeParse({
      display_name: displayName,
      bio,
      avatar_url: avatarUrl,
    });
    if (!parsed.success) {
      setMsg({ kind: "err", text: parsed.error.issues[0]?.message ?? "Invalid input" });
      return;
    }

    setSaving(true);
    const payload = {
      id: userId,
      display_name: parsed.data.display_name || null,
      bio: parsed.data.bio || null,
      avatar_url: parsed.data.avatar_url || null,
    };
    const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
    setSaving(false);
    if (error) {
      setMsg({ kind: "err", text: error.message });
    } else {
      setMsg({ kind: "ok", text: "Profile saved." });
    }
  }

  async function handleAvatarFile(file: File) {
    if (!userId) return;
    setMsg(null);
    if (!AVATAR_ALLOWED_TYPES.includes(file.type)) {
      setMsg({ kind: "err", text: "Please choose a PNG, JPEG, WebP, or GIF image." });
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setMsg({ kind: "err", text: "Image is too large. Max 3 MB." });
      return;
    }
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { cacheControl: "3600", upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: signed, error: signErr } = await supabase.storage
        .from("avatars")
        .createSignedUrl(path, AVATAR_SIGNED_URL_TTL);
      if (signErr || !signed?.signedUrl) throw signErr ?? new Error("Failed to create link");
      setAvatarUrl(signed.signedUrl);
      setMsg({ kind: "ok", text: "Avatar uploaded. Click Save profile to keep it." });
    } catch (err) {
      setMsg({ kind: "err", text: (err as Error).message || "Upload failed" });
    } finally {
      setUploading(false);
    }
  }

  const initial = (displayName || email || "?").trim().charAt(0).toUpperCase();

  const tabs: { key: TabKey; label: string; icon: LucideIcon }[] = [
    { key: "profile", label: "Your Profile", icon: User },
    { key: "streak", label: "Streak", icon: Flame },
    { key: "badges", label: "Badges", icon: Award },
    { key: "qr", label: "QR & Privacy", icon: QrCode },
    { key: "reports", label: "Reports", icon: FileText },
    { key: "tutorial", label: "Website Tutorial", icon: GraduationCap },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined" && window.history.length > 1) {
              window.history.back();
            } else {
              window.location.href = "/";
            }
          }}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent hover:text-accent-foreground"
          aria-label="Go back"
        >
          <span aria-hidden="true">←</span> Back
        </button>

        <h1 className="mt-2 text-3xl font-bold tracking-tight">Your profile</h1>
        <p className="mt-1 text-muted-foreground">
          Customize how you appear across PY Kidda.
        </p>

        {loading ? (
          <p className="mt-10 text-muted-foreground">Loading…</p>
        ) : (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
            {/* Vertical sidebar nav */}
            <nav
              className="md:sticky md:top-6 md:self-start rounded-2xl border border-border bg-card p-2 shadow-[var(--shadow-warm)] flex md:flex-col gap-1 overflow-x-auto md:overflow-visible"
              aria-label="Profile sections"
            >
              {tabs.map((t) => {
                const Icon = t.icon;
                const selected = activeTab === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setActiveTab(t.key)}
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
            </nav>

            {/* Section content */}
            <div className="min-w-0">
              {activeTab === "profile" && (
                <form
                  onSubmit={save}
                  className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-warm)] flex flex-col gap-5"
                >
                  <div className="flex items-center gap-4">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt="Avatar preview"
                        className="h-16 w-16 rounded-full object-cover border border-border"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <span
                        className="inline-flex h-16 w-16 items-center justify-center rounded-full text-2xl font-black text-primary-foreground"
                        style={{ backgroundImage: "var(--gradient-sunrise)" }}
                      >
                        {initial}
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold truncate">{displayName || "Unnamed kidda"}</p>
                        <span
                          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                          style={{
                            borderColor:
                              presenceStatus === "active"
                                ? "oklch(0.65 0.15 145 / 0.4)"
                                : presenceStatus === "idle"
                                  ? "oklch(0.75 0.15 85 / 0.4)"
                                  : "oklch(0.6 0 0 / 0.3)",
                            color:
                              presenceStatus === "active"
                                ? "oklch(0.5 0.15 145)"
                                : presenceStatus === "idle"
                                  ? "oklch(0.55 0.15 70)"
                                  : "oklch(0.5 0 0)",
                            backgroundColor:
                              presenceStatus === "active"
                                ? "oklch(0.65 0.15 145 / 0.1)"
                                : presenceStatus === "idle"
                                  ? "oklch(0.75 0.15 85 / 0.1)"
                                  : "oklch(0.6 0 0 / 0.08)",
                          }}
                          aria-label={`Status: ${presenceStatus}`}
                        >
                          <span
                            className={`inline-block h-2 w-2 rounded-full ${presenceStatus === "active" ? "animate-pulse" : ""}`}
                            style={{
                              backgroundColor:
                                presenceStatus === "active"
                                  ? "oklch(0.65 0.18 145)"
                                  : presenceStatus === "idle"
                                    ? "oklch(0.75 0.18 80)"
                                    : "oklch(0.55 0 0)",
                            }}
                          />
                          {presenceStatus.charAt(0).toUpperCase() + presenceStatus.slice(1)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{email}</p>
                      {studentUniqueId && (
                        <p className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-accent/50 bg-accent/15 px-2.5 py-0.5 text-[11px] font-mono font-semibold text-foreground">
                          <span className="text-muted-foreground">Student ID:</span>
                          <span className="tracking-wider text-foreground">{studentUniqueId}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium">Status</span>
                    <div className="inline-flex rounded-lg border border-input bg-background p-1 w-fit" role="radiogroup" aria-label="Presence status">
                      {(["active", "idle", "offline"] as const).map((s) => {
                        const selected = presenceStatus === s;
                        const dotColor =
                          s === "active"
                            ? "oklch(0.65 0.18 145)"
                            : s === "idle"
                              ? "oklch(0.75 0.18 80)"
                              : "oklch(0.55 0 0)";
                        return (
                          <button
                            key={s}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            disabled={savingStatus}
                            onClick={() => { if (!selected) void updatePresenceStatus(s); }}
                            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                              selected ? "bg-accent text-accent-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: dotColor }} />
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </button>
                        );
                      })}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Let others know if you're around. Shown on your public profile.
                    </span>
                  </div>

                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium">Display name</span>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      maxLength={60}
                      placeholder="e.g. Ada Lovelace"
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-accent"
                    />
                    <span className="text-xs text-muted-foreground">{displayName.length}/60</span>
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium">Bio</span>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      maxLength={280}
                      rows={4}
                      placeholder="A short intro — what are you learning?"
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-accent resize-y"
                    />
                    <span className="text-xs text-muted-foreground">{bio.length}/280</span>
                  </label>

                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium">Avatar image</span>
                    <div className="flex flex-wrap items-center gap-3">
                      <label
                        className={`inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-muted ${
                          uploading ? "pointer-events-none opacity-60" : ""
                        }`}
                      >
                        {uploading ? "Uploading…" : avatarUrl ? "Change photo" : "Choose photo"}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          className="hidden"
                          disabled={uploading}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            e.target.value = "";
                            if (f) void handleAvatarFile(f);
                          }}
                        />
                      </label>
                      {avatarUrl && (
                        <button
                          type="button"
                          onClick={() => setAvatarUrl("")}
                          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      PNG, JPEG, WebP, or GIF. Max 3 MB. Leave empty for the gradient avatar.
                    </span>
                  </div>

                  {msg && (
                    <div
                      className={`rounded-md border p-3 text-sm ${
                        msg.kind === "ok"
                          ? "border-[oklch(0.65_0.15_145)]/40 bg-[oklch(0.65_0.15_145)]/10 text-[oklch(0.45_0.15_145)]"
                          : "border-destructive/40 bg-destructive/10 text-destructive"
                      }`}
                    >
                      {msg.text}
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)] disabled:opacity-50"
                      style={{ backgroundImage: "var(--gradient-sunrise)" }}
                    >
                      {saving ? "Saving…" : "Save profile"}
                    </button>
                  </div>
                </form>
              )}

              {activeTab === "streak" && <StreakCard />}

              {activeTab === "badges" && (
                <div className="flex flex-col gap-6">
                  <YourNextBadges />
                  {userId && <BadgesGrid studentId={userId} />}
                </div>
              )}

              {activeTab === "qr" && (
                <div className="flex flex-col gap-6">
                  {publicId && (
                    <ProfileQrCard publicId={publicId} displayName={displayName} enabled={qrEnabled} />
                  )}
                  <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-warm)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-bold">Public QR profile settings</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Control exactly what people see when they scan your QR code. Personal info
                          (email, phone, birth date) is never shared — even if all switches are on.
                        </p>
                      </div>
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm font-semibold">
                        <input
                          type="checkbox"
                          checked={qrEnabled}
                          onChange={toggleQrEnabled}
                          disabled={savingPrivacy}
                          className="h-4 w-4"
                        />
                        {qrEnabled ? "QR profile is ON" : "QR profile is OFF"}
                      </label>
                    </div>

                    <div className={`mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 ${qrEnabled ? "" : "opacity-50 pointer-events-none"}`}>
                      {(
                        [
                          ["showAvatar", "Show avatar"],
                          ["showClass", "Show class / college"],
                          ["showStreak", "Show streak 🔥"],
                          ["showBadges", "Show badges 🏅"],
                          ["showCertificates", "Show certificates"],
                          ["showLeaderboardRank", "Show leaderboard rank"],
                          ["showCompletedUnits", "Show completed units & progress"],
                        ] as [keyof PublicProfileSettings, string][]
                      ).map(([key, label]) => (
                        <label
                          key={key}
                          className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm"
                        >
                          <span>{label}</span>
                          <input
                            type="checkbox"
                            checked={publicSettings[key]}
                            onChange={() => toggleSetting(key)}
                            disabled={savingPrivacy}
                            className="h-4 w-4"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "reports" && userId && <MyReports userId={userId} />}

              {activeTab === "tutorial" && (
                <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-warm)]">
                  <h2 className="text-lg font-bold">Website tutorial</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Replay the friendly onboarding tour with Pyko, your Python guide.
                  </p>
                  <button
                    type="button"
                    onClick={() => restartTutorial()}
                    className="mt-4 rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold hover:border-accent transition-colors"
                  >
                    🐍 Restart website tutorial
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}


type MyReport = {
  id: string;
  subject: string;
  problem_type: string;
  status: string;
  priority: string;
  admin_response: string | null;
  created_at: string;
};

function MyReports({ userId }: { userId: string }) {
  const [rows, setRows] = useState<MyReport[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data } = await supabase
        .from("problem_reports")
        .select("id, subject, problem_type, status, priority, admin_response, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (!mounted) return;
      setRows((data as MyReport[]) ?? []);
      setLoading(false);
    }
    load();
    const channel = supabase
      .channel("my_reports_" + userId)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "problem_reports", filter: `user_id=eq.${userId}` },
        load,
      )
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const tone = (s: string) =>
    s === "Resolved"
      ? "bg-emerald-500/15 text-emerald-600"
      : s === "In Progress"
        ? "bg-sky-500/15 text-sky-600"
        : s === "Rejected"
          ? "bg-destructive/15 text-destructive"
          : "bg-amber-500/15 text-amber-600";

  return (
    <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-warm)]">
      <h2 className="text-lg font-bold">My reports</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Problems you've reported. You'll see the admin's response here once it's added.
      </p>
      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          You haven't reported anything yet. Use the floating "Report a problem" button on any page.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="py-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="font-semibold">{r.subject}</p>
                <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${tone(r.status)}`}>
                  {r.status}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {r.problem_type} · {r.priority} · {new Date(r.created_at).toLocaleString()}
              </p>
              {r.admin_response && (
                <p className="mt-2 whitespace-pre-wrap rounded-md border border-border bg-background/40 p-2 text-sm">
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Admin response
                  </span>
                  <br />
                  {r.admin_response}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

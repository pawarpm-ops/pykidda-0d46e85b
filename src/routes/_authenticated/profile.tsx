import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { restartTutorial } from "@/components/OnboardingTutorial";
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
    .max(500, "Max 500 characters")
    .url("Must be a valid URL")
    .optional()
    .or(z.literal("")),
});

function ProfilePage() {
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setEmail(u.user.email ?? null);
      setUserId(u.user.id);
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, bio, avatar_url")
        .eq("id", u.user.id)
        .maybeSingle();
      if (error) {
        setMsg({ kind: "err", text: error.message });
      } else if (data) {
        setDisplayName(data.display_name ?? "");
        setBio(data.bio ?? "");
        setAvatarUrl(data.avatar_url ?? "");
      }
      setLoading(false);
    })();
  }, []);

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

  const initial = (displayName || email || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <Link to="/" className="text-sm text-muted-foreground hover:text-accent">
          ← Back to home
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Your profile</h1>
        <p className="mt-1 text-muted-foreground">
          Customize how you appear across PY Kidda.
        </p>

        {loading ? (
          <p className="mt-10 text-muted-foreground">Loading…</p>
        ) : (
          <form
            onSubmit={save}
            className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-warm)] flex flex-col gap-5"
          >
            <div className="flex items-center gap-4">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
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
                <p className="font-semibold truncate">{displayName || "Unnamed kidda"}</p>
                <p className="text-sm text-muted-foreground truncate">{email}</p>
              </div>
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

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Avatar URL</span>
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                maxLength={500}
                placeholder="https://…/photo.png"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <span className="text-xs text-muted-foreground">
                Paste a link to an image. Leave empty for the gradient avatar.
              </span>
            </label>

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

        <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-warm)]">
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
      </main>
    </div>
  );
}

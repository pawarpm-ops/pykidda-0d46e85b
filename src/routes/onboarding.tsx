import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Welcome · PY Kidda" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OnboardingPage,
  ssr: false,
});

const schema = z.object({
  full_name: z.string().trim().min(2, "Please enter your full name").max(80),
  contact_number: z
    .string()
    .trim()
    .min(7, "Enter a valid contact number")
    .max(20)
    .regex(/^[+\d][\d\s-]*$/, "Digits, spaces, + and - only"),
  college_name: z.string().trim().min(2, "Enter your college name").max(120),
  age: z.coerce.number().int().min(5, "Age looks too low").max(120, "Age looks too high"),
  gender: z.enum(["male", "female", "other", "prefer_not"], {
    errorMap: () => ({ message: "Select an option" }),
  }),
  birth_date: z.string().min(1, "Pick your birth date"),
});

function OnboardingPage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [form, setForm] = useState({
    full_name: "",
    contact_number: "",
    college_name: "",
    age: "",
    gender: "",
    birth_date: "",
  });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      setUserId(data.user.id);
      const { data: p } = await supabase
        .from("profiles")
        .select("onboarded, full_name, contact_number, college_name, age, gender, birth_date")
        .eq("id", data.user.id)
        .maybeSingle();
      if (p?.onboarded) {
        navigate({ to: "/", replace: true });
        return;
      }
      if (p) {
        setForm({
          full_name: p.full_name ?? "",
          contact_number: p.contact_number ?? "",
          college_name: p.college_name ?? "",
          age: p.age?.toString() ?? "",
          gender: p.gender ?? "",
          birth_date: p.birth_date ?? "",
        });
      }
      setChecking(false);
    })();
  }, [navigate]);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setErr(null);
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      setErr(parsed.error.issues[0]?.message ?? "Please complete every field");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("profiles").upsert(
      {
        id: userId,
        full_name: parsed.data.full_name,
        display_name: parsed.data.full_name,
        contact_number: parsed.data.contact_number,
        college_name: parsed.data.college_name,
        age: parsed.data.age,
        gender: parsed.data.gender,
        birth_date: parsed.data.birth_date,
        onboarded: true,
      },
      { onConflict: "id" },
    );
    setSaving(false);
    if (error) {
      setErr(error.message);
      return;
    }
    navigate({ to: "/", replace: true });
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0b0b1f] text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(99,102,241,0.35), transparent 40%), radial-gradient(circle at 80% 80%, rgba(244,114,182,0.30), transparent 45%), radial-gradient(circle at 50% 50%, rgba(251,191,36,0.20), transparent 55%)",
        }}
      />
      <div className="relative mx-auto max-w-2xl px-6 py-12">
        <div className="mb-8 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-300/90 font-semibold">
            Welcome to PY Kidda
          </p>
          <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">
            Tell us a little about you
          </h1>
          <p className="mt-2 text-sm text-white/70">
            We need a few details before you can start learning. This is a one-time setup.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6 md:p-8 shadow-2xl flex flex-col gap-5"
        >
          <Field label="Full name">
            <input
              required
              type="text"
              value={form.full_name}
              onChange={(e) => set("full_name", e.target.value)}
              maxLength={80}
              placeholder="e.g. Siddharth Pawar"
              className="input-dark"
            />
          </Field>

          <Field label="Contact number">
            <input
              required
              type="tel"
              value={form.contact_number}
              onChange={(e) => set("contact_number", e.target.value)}
              maxLength={20}
              placeholder="e.g. +91 91725 04205"
              className="input-dark"
            />
          </Field>

          <Field label="College name">
            <input
              required
              type="text"
              value={form.college_name}
              onChange={(e) => set("college_name", e.target.value)}
              maxLength={120}
              placeholder="e.g. ABC Institute of Technology"
              className="input-dark"
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Age">
              <input
                required
                type="number"
                min={5}
                max={120}
                value={form.age}
                onChange={(e) => set("age", e.target.value)}
                placeholder="e.g. 18"
                className="input-dark"
              />
            </Field>

            <Field label="Gender">
              <select
                required
                value={form.gender}
                onChange={(e) => set("gender", e.target.value)}
                className="input-dark"
              >
                <option value="" disabled>
                  Select…
                </option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not">Prefer not to say</option>
              </select>
            </Field>
          </div>

          <Field label="Birth date">
            <input
              required
              type="date"
              value={form.birth_date}
              onChange={(e) => set("birth_date", e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              className="input-dark"
            />
          </Field>

          {err && (
            <div className="rounded-md border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {err}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={signOut}
              className="text-sm text-white/60 hover:text-white underline-offset-4 hover:underline"
            >
              Sign out
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md px-6 py-2.5 text-sm font-semibold text-black shadow-lg disabled:opacity-50"
              style={{ backgroundImage: "linear-gradient(135deg, #fbbf24, #f59e0b)" }}
            >
              {saving ? "Saving…" : "Continue →"}
            </button>
          </div>

          <p className="text-center text-xs text-white/50">
            You must complete this form to use PY Kidda.
          </p>
        </form>
      </div>

      <style>{`
        .input-dark {
          width: 100%;
          border-radius: 0.5rem;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          padding: 0.625rem 0.875rem;
          font-size: 0.9rem;
          color: white;
          outline: none;
          transition: border-color 0.15s, background 0.15s;
        }
        .input-dark::placeholder { color: rgba(255,255,255,0.4); }
        .input-dark:focus { border-color: #fbbf24; background: rgba(255,255,255,0.10); }
        .input-dark option { color: #111; }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs uppercase tracking-widest font-semibold text-white/70">{label}</span>
      {children}
    </label>
  );
}

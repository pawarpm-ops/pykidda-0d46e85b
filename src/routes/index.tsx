import { createFileRoute } from "@tanstack/react-router";
import HeroSection from "@/components/HeroSection";
import {
  BookOpen,
  Code2,
  ClipboardList,
  GraduationCap,
  Mail,
  Rocket,
  Phone,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { COMMUNITY } from "@/config/community";
import PyKiddaDashboard from "@/components/dashboard/PyKiddaDashboard";
import meenakshiAsset from "@/assets/meenakshi.png.asset.json";
import prashantAsset from "@/assets/prashant.png.asset.json";
import vaishnaviAsset from "@/assets/vaishnavi.jpg.asset.json";
import siddharthAsset from "@/assets/siddharth-portrait.jpg.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PY Kidda — Be a PY Kidda with Us" },
      {
        name: "description",
        content:
          "Learn Python. Solve challenges. Build real skills. Practice Python questions, take secure mock tests, and grow with PY Kidda.",
      },
      { property: "og:title", content: "PY Kidda — Be a PY Kidda with Us" },
      {
        property: "og:description",
        content:
          "Learn Python. Solve challenges. Build real skills. Practice, mock tests, homework and more.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {







  return (
    <div
      className="min-h-dvh text-[#F8FAFC]"
      style={{ background: "#040619" }}
    >
      <SiteHeader />

      <main className="pk-dashboard mx-auto w-full" style={{ maxWidth: 1240 }}>
        <style>{`
          .pk-dashboard { padding-left: 16px; padding-right: 16px; }
          @media (min-width: 768px) { .pk-dashboard { padding-left: 24px; padding-right: 24px; } }
          @media (min-width: 1024px) { .pk-dashboard { padding-left: 32px; padding-right: 32px; } }
          @keyframes pk-orbit { from { transform: rotate(0deg) translateX(0); } to { transform: rotate(360deg) translateX(0); } }
          @keyframes pk-glow-pulse { 0%,100% { opacity: .55; } 50% { opacity: .9; } }
        `}</style>

        {/* HERO */}
        <HeroSection />


        {/* Everything You Need — rendered by PyKiddaDashboard's auto-rotating carousel */}
        <PyKiddaDashboard />



        {/* People Behind PY Kidda */}
        <SectionHeader
          eyebrow="Our Team"
          title="People Behind PY Kidda"
          subtitle="The people who made this platform possible."
        />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <PersonCard
            src={meenakshiAsset.url}
            name="Dr. Meenakshi Mukund Pawar"
            role="Vice Principal, SVERI College"
            help="Testing & Funding"
            objectPosition="center top"
          />
          <PersonCard
            src={prashantAsset.url}
            name="Dr. Prashant Maruti Pawar"
            role="Professor, SVERI College"
            help="Testing & Funding"
            objectPosition="center top"
          />
          <PersonCard
            src={vaishnaviAsset.url}
            name="Vaishnavi Jadhav"
            role="Lab Assistant"
            help="Testing & Developing"
            objectPosition="center top"
          />
        </div>

        {/* Creator Spotlight */}
        <section className="relative my-20 overflow-hidden rounded-[24px] border border-white/10 bg-gradient-to-br from-[#0B1022] via-[#0A0E20] to-[#070A18]">
          {/* Giant faded PY monogram */}
          <div
            aria-hidden
            className="pointer-events-none absolute right-4 bottom-0 select-none text-[220px] font-black leading-none text-white/[0.03] sm:text-[300px] lg:text-[360px]"
          >
            PY
          </div>

          <div className="relative grid gap-0 md:grid-cols-2">
            {/* LEFT: Portrait with arch frame + orbital rings */}
            <div className="relative flex items-center justify-center overflow-hidden border-b border-white/5 bg-[#0A0E22] px-8 py-14 md:border-b-0 md:border-r md:py-16">
              {/* Orbital rings */}
              <div
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-500/10"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-500/15"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-1/2 h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-400/20"
              />
              {/* Orbit dots */}
              <span
                aria-hidden
                className="absolute left-1/2 top-[7%] h-2 w-2 -translate-x-1/2 rounded-full bg-amber-400 shadow-[0_0_12px_2px_rgba(251,191,36,0.7)]"
              />
              <span
                aria-hidden
                className="absolute left-[6%] top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-amber-400 shadow-[0_0_12px_2px_rgba(251,191,36,0.7)]"
              />
              {/* Grid dot texture */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-[0.08]"
                style={{
                  backgroundImage:
                    "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)",
                  backgroundSize: "22px 22px",
                }}
              />

              {/* Arched portrait frame */}
              <div className="relative">
                <div
                  className="relative w-[240px] p-[3px] sm:w-[280px] lg:w-[320px]"
                  style={{
                    background:
                      "linear-gradient(180deg, #F5C36A 0%, #B7822D 100%)",
                    borderRadius: "9999px 9999px 24px 24px",
                    boxShadow:
                      "0 20px 60px -20px rgba(251,191,36,0.35), inset 0 0 0 1px rgba(255,255,255,0.08)",
                  }}
                >
                  <div
                    className="overflow-hidden bg-[#0A0E22]"
                    style={{ borderRadius: "9999px 9999px 22px 22px" }}
                  >
                    <img
                      src={siddharthAsset.url}
                      alt="Siddharth Pawar, creator of PY Kidda"
                      loading="lazy"
                      className="block h-[300px] w-full object-cover sm:h-[360px] lg:h-[420px]"
                      style={{ objectPosition: "center top" }}
                    />
                  </div>
                </div>

                {/* Creator of PY Kidda pill */}
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-amber-400/30 bg-[#0B1022] px-4 py-2 text-xs font-semibold text-amber-200 shadow-lg">
                  <span className="mr-1.5 text-amber-400">✦</span>
                  Creator of PY Kidda
                </div>
              </div>
            </div>

            {/* RIGHT: Content */}
            <div className="flex flex-col justify-center px-6 py-12 sm:px-10 md:px-12 lg:px-16 lg:py-16">
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-amber-400">
                Meet the Creator
              </p>
              <h2 className="mt-4 text-4xl font-bold leading-[1.05] text-white sm:text-5xl lg:text-6xl">
                Built by
                <br />
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage:
                      "linear-gradient(90deg, #FBBF24 0%, #F97316 60%, #FB923C 100%)",
                  }}
                >
                  Siddharth Pawar
                </span>
              </h2>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-[#94A3B8] sm:text-lg">
                “I am Siddharth Pawar, and I created this platform for students who
                want to learn, code, and then grow.”
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <BlockPill label="LEARN" />
                <ArrowChev />
                <BlockPill label="CODE" />
                <ArrowChev />
                <BlockPill label="GROW" />
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <ContactCard
                  href={`tel:${COMMUNITY.contactPhone}`}
                  eyebrow="Call Siddharth"
                  value={COMMUNITY.contactPhone}
                  icon={<Phone className="h-5 w-5 text-slate-900" />}
                />
                <ContactCard
                  href={`mailto:${COMMUNITY.contactEmail}`}
                  eyebrow="Email"
                  value={COMMUNITY.contactEmail}
                  icon={<Mail className="h-5 w-5 text-slate-900" />}
                />
              </div>
            </div>
          </div>
        </section>


        <footer className="border-t border-white/10 py-8 pb-28 lg:pb-8 text-center text-xs text-[#94A3B8]">
          PY Kidda · Be a PY Kidda with Us · © Siddharth Prashant Pawar
        </footer>
      </main>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mt-16 mb-6 sm:mt-20 sm:mb-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-orange-300">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-2xl font-black sm:text-3xl text-[#F8FAFC]">{title}</h2>
      {subtitle && <p className="mt-2 max-w-2xl text-sm text-[#94A3B8]">{subtitle}</p>}
    </div>
  );
}

function IconTile({
  from,
  to,
  children,
}: {
  from: string;
  to: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="grid h-12 w-12 place-items-center rounded-2xl"
      style={{
        background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
        boxShadow: "0 10px 24px -14px rgba(249,115,22,0.5)",
      }}
    >
      {children}
    </div>
  );
}

function PersonCard({
  src,
  name,
  role,
  help,
  objectPosition,
}: {
  src: string;
  name: string;
  role: string;
  help: string;
  objectPosition?: string;
}) {
  return (
    <article className="group flex flex-col items-center rounded-[20px] border border-white/10 bg-[#11172C] p-6 text-center transition-all duration-300 hover:-translate-y-1.5 hover:border-orange-400/60">
      <div className="relative">
        <div
          className="absolute inset-0 -m-1 rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          aria-hidden
          style={{
            background:
              "conic-gradient(from 0deg, #F97316, #FBBF24, #FB923C, #F97316)",
            filter: "blur(10px)",
          }}
        />
        <img
          src={src}
          alt={name}
          loading="lazy"
          className="relative h-32 w-32 rounded-full object-cover ring-2 ring-white/15"
          style={{ objectPosition: objectPosition ?? "center" }}
        />
      </div>
      <h3 className="mt-5 text-lg font-bold text-[#F8FAFC]">{name}</h3>
      <p className="mt-1 text-sm text-[#94A3B8]">{role}</p>
      <span
        className="mt-4 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-slate-900"
        style={{
          background: "linear-gradient(90deg, #FBBF24 0%, #F97316 100%)",
        }}
      >
        {help}
      </span>
    </article>
  );
}

function StepPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-semibold text-white">
      {icon}
      {label}
    </span>
  );
}

function BlockPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-lg border border-white/10 bg-[#111730] px-4 py-2 text-sm font-bold tracking-wider text-white">
      {label}
    </span>
  );
}

function ArrowChev() {
  return (
    <span aria-hidden className="text-lg text-[#94A3B8]">
      →
    </span>
  );
}

function ContactCard({
  href,
  eyebrow,
  value,
  icon,
}: {
  href: string;
  eyebrow: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-white/10 bg-[#0F142A] p-3.5 transition hover:border-amber-400/40 hover:bg-[#141A34]"
    >
      <span
        className="grid h-11 w-11 shrink-0 place-items-center rounded-lg"
        style={{
          background: "linear-gradient(135deg, #FBBF24 0%, #F97316 100%)",
          boxShadow: "0 8px 20px -10px rgba(249,115,22,0.6)",
        }}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-[#94A3B8]">
          {eyebrow}
        </span>
        <span className="mt-0.5 block truncate text-sm font-semibold text-white">
          {value}
        </span>
      </span>
    </a>
  );
}

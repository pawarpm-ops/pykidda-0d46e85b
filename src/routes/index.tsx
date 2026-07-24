import { createFileRoute, useNavigate } from "@tanstack/react-router";
import HeroSection from "@/components/HeroSection";
import {
  BookOpen,
  Code2,
  ClipboardList,
  GraduationCap,
  Mail,
  ShieldCheck,
  Lock,
  UserCheck,
  HelpCircle,
  Rocket,
  Phone,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import {
  InfiniteCardCarousel,
  type CarouselCard,
} from "@/components/dashboard/InfiniteCardCarousel";
import { COMMUNITY } from "@/config/community";
import PyKiddaDashboard from "@/components/dashboard/PyKiddaDashboard";
import meenakshiAsset from "@/assets/meenakshi.png.asset.json";
import prashantAsset from "@/assets/prashant.png.asset.json";
import vaishnaviAsset from "@/assets/vaishnavi.jpg.asset.json";
import siddharthAsset from "@/assets/siddharth.jpg.asset.json";

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
  const navigate = useNavigate();






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
        <section className="relative my-20 overflow-hidden rounded-[20px] border border-white/10 bg-gradient-to-br from-[#11172C] to-[#0B1022] p-6 sm:p-10">
          <div
            className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full"
            aria-hidden
            style={{
              background:
                "radial-gradient(circle, rgba(249,115,22,0.35) 0%, transparent 65%)",
              animation: "pk-glow-pulse 6s ease-in-out infinite",
            }}
          />
          <div
            className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full"
            aria-hidden
            style={{
              background:
                "radial-gradient(circle, rgba(251,191,36,0.25) 0%, transparent 65%)",
              animation: "pk-glow-pulse 8s ease-in-out infinite",
            }}
          />
          <div className="relative grid items-center gap-8 md:grid-cols-[auto_1fr]">
            <div className="relative mx-auto md:mx-0">
              <div
                className="absolute inset-0 -m-2 rounded-full"
                aria-hidden
                style={{
                  background:
                    "conic-gradient(from 0deg, #F97316, #FBBF24, #FB923C, #F97316)",
                  filter: "blur(12px)",
                  opacity: 0.55,
                }}
              />
              <img
                src={siddharthAsset.url}
                alt="Siddharth Pawar, creator of PY Kidda"
                loading="lazy"
                className="relative h-40 w-40 rounded-full object-cover ring-4 ring-[#0B1022] sm:h-48 sm:w-48"
                style={{ objectPosition: "center top" }}
              />
            </div>
            <div className="text-center md:text-left">
              <p className="text-xs font-semibold uppercase tracking-wider text-orange-300">
                Creator
              </p>
              <h3 className="mt-2 text-2xl font-black sm:text-3xl">Siddharth Pawar</h3>
              <p className="mt-3 max-w-2xl text-[#94A3B8]">
                “I am Siddharth Pawar, and I created this platform for students who want to
                learn, code, and then grow.”
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2 md:justify-start">
                <StepPill icon={<GraduationCap className="h-4 w-4" />} label="Learn" />
                <ArrowChev />
                <StepPill icon={<Code2 className="h-4 w-4" />} label="Code" />
                <ArrowChev />
                <StepPill icon={<Rocket className="h-4 w-4" />} label="Grow" />
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3 md:justify-start">
                <a
                  href={`tel:${COMMUNITY.contactPhone}`}
                  className="pk-touch inline-flex min-h-11 items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-slate-900 shadow-lg transition hover:brightness-110"
                  style={{
                    background:
                      "linear-gradient(90deg, #FBBF24 0%, #F97316 50%, #FB923C 100%)",
                    boxShadow: "0 10px 24px -14px rgba(249,115,22,0.6)",
                  }}
                >
                  <Phone className="h-4 w-4" aria-hidden />
                  Call {COMMUNITY.contactPhone}
                </a>
                <a
                  href={`mailto:${COMMUNITY.contactEmail}`}
                  className="pk-touch inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 hover:border-orange-400/60"
                >
                  <Mail className="h-4 w-4" aria-hidden />
                  {COMMUNITY.contactEmail}
                </a>
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

function ArrowChev() {
  return (
    <span aria-hidden className="text-orange-300">
      →
    </span>
  );
}

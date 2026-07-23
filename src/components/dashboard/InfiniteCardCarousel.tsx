import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type CarouselCard = {
  id: string;
  header: ReactNode;
  title: string;
  description: string;
  status?: string;
  cta: { label: string; onClick?: () => void; href?: string; disabled?: boolean };
};

type Props = {
  cards: CarouselCard[];
  ariaLabel: string;
};

/**
 * Seamless infinite horizontal carousel with 3/2/1 responsive layout.
 * - Pauses on hover/focus
 * - Prev/Next controls with keyboard support
 * - Respects prefers-reduced-motion (disables autoplay)
 */
export function InfiniteCardCarousel({ cards, ariaLabel }: Props) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [perView, setPerView] = useState(3);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const offsetRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);

  // Responsive per-view
  useLayoutEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      setPerView(w >= 1024 ? 3 : w >= 640 ? 2 : 1);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Reduced motion
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = () => setReduced(mq.matches);
    handler();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Duplicate cards for seamless loop
  const loop = [...cards, ...cards];

  const step = useCallback((dir: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const firstChild = track.children[0] as HTMLElement | undefined;
    if (!firstChild) return;
    const gap = parseFloat(getComputedStyle(track).columnGap || "24");
    const cardWidth = firstChild.offsetWidth + gap;
    offsetRef.current += dir * cardWidth;
    applyOffset(true);
  }, []);

  const applyOffset = (smooth: boolean) => {
    const track = trackRef.current;
    if (!track) return;
    track.style.transition = smooth ? "transform 500ms ease" : "none";
    track.style.transform = `translate3d(${-offsetRef.current}px, 0, 0)`;
  };

  // Wrap when we've moved past one full set of originals
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const onEnd = () => {
      const total = track.scrollWidth / 2;
      if (offsetRef.current >= total) {
        offsetRef.current -= total;
        applyOffset(false);
      } else if (offsetRef.current < 0) {
        offsetRef.current += total;
        applyOffset(false);
      }
    };
    track.addEventListener("transitionend", onEnd);
    return () => track.removeEventListener("transitionend", onEnd);
  }, []);

  // Autoplay
  useEffect(() => {
    if (reduced) return;
    const speed = 40; // px/sec continuous drift
    const tick = (ts: number) => {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;
      if (!paused) {
        offsetRef.current += speed * dt;
        const track = trackRef.current;
        if (track) {
          const total = track.scrollWidth / 2;
          if (total > 0 && offsetRef.current >= total) offsetRef.current -= total;
          track.style.transition = "none";
          track.style.transform = `translate3d(${-offsetRef.current}px, 0, 0)`;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = null;
    };
  }, [paused, reduced]);

  return (
    <div
      className="relative"
      role="region"
      aria-roledescription="carousel"
      aria-label={ariaLabel}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="overflow-hidden">
        <div
          ref={trackRef}
          className="flex gap-6 will-change-transform"
          style={{ transform: "translate3d(0,0,0)" }}
        >
          {loop.map((c, i) => (
            <div
              key={`${c.id}-${i}`}
              className="shrink-0"
              style={{ width: `calc((100% - ${(perView - 1) * 24}px) / ${perView})` }}
            >
              <CarouselCardView card={c} />
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        aria-label="Previous"
        onClick={() => step(-1)}
        className="pk-touch absolute -left-2 top-1/2 -translate-y-1/2 z-10 grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-[#0B1022]/80 text-white backdrop-blur hover:border-orange-400/60 hover:text-orange-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        aria-label="Next"
        onClick={() => step(1)}
        className="pk-touch absolute -right-2 top-1/2 -translate-y-1/2 z-10 grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-[#0B1022]/80 text-white backdrop-blur hover:border-orange-400/60 hover:text-orange-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}

function CarouselCardView({ card }: { card: CarouselCard }) {
  const btnClass = cn(
    "pk-touch inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
    card.cta.disabled
      ? "cursor-not-allowed bg-white/5 text-white/40 border border-white/10"
      : "text-slate-900 shadow-lg hover:brightness-110",
  );
  const btnStyle = card.cta.disabled
    ? undefined
    : {
        background: "linear-gradient(90deg, #FBBF24 0%, #F97316 50%, #FB923C 100%)",
        boxShadow: "0 10px 24px -14px rgba(249,115,22,0.6)",
      };

  const Cta = () => {
    if (card.cta.disabled) {
      return (
        <span className={btnClass} aria-disabled="true">
          {card.cta.label}
        </span>
      );
    }
    if (card.cta.href) {
      const external = /^https?:|^mailto:|^tel:/.test(card.cta.href);
      return (
        <a
          href={card.cta.href}
          target={external ? "_blank" : undefined}
          rel={external ? "noopener noreferrer" : undefined}
          className={btnClass}
          style={btnStyle}
        >
          {card.cta.label}
        </a>
      );
    }
    return (
      <button type="button" onClick={card.cta.onClick} className={btnClass} style={btnStyle}>
        {card.cta.label}
      </button>
    );
  };

  return (
    <article
      className="group relative flex h-full min-h-[360px] flex-col overflow-hidden rounded-[20px] border border-white/10 bg-[#11172C] p-6 transition-all duration-300 hover:-translate-y-1.5 hover:border-orange-400/60"
      style={{ boxShadow: "0 20px 40px -30px rgba(0,0,0,0.6)" }}
    >
      <div className="pointer-events-none absolute inset-0 rounded-[20px] opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ boxShadow: "0 0 0 1px rgba(251,146,60,0.4), 0 20px 60px -20px rgba(249,115,22,0.35)" }} />
      <div className="relative">{card.header}</div>
      <h3 className="relative mt-5 text-xl font-bold text-[#F8FAFC]">{card.title}</h3>
      <p className="relative mt-2 text-sm leading-relaxed text-[#94A3B8]">{card.description}</p>
      {card.status && (
        <p className="relative mt-3 text-xs font-medium uppercase tracking-wide text-orange-300/90">
          {card.status}
        </p>
      )}
      <div className="relative mt-auto pt-6">
        <Cta />
      </div>
    </article>
  );
}

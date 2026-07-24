import { Link } from "@tanstack/react-router";
import { ArrowRight, X } from "lucide-react";
import { useEffect, useState } from "react";
import "./PyKiddaDashboard.css";

import {
  contactCards,
  learningCards,
  whyPyKiddaCards,
} from "./dashboardData";
import type { DashboardCardItem } from "./dashboardTypes";

const COLOR_MAP: Record<string, string> = {
  orange: "var(--pk-orange)",
  blue: "var(--pk-blue)",
  green: "var(--pk-green)",
  purple: "var(--pk-purple)",
  pink: "var(--pk-pink)",
  cyan: "var(--pk-cyan)",
  red: "var(--pk-red)",
  yellow: "var(--pk-yellow)",
};

function Card({ item, index }: { item: DashboardCardItem; index: number }) {
  const style = { ["--pk-accent" as string]: COLOR_MAP[item.color] ?? "var(--pk-orange)" } as React.CSSProperties;
  const num = String(index + 1).padStart(2, "0");
  const meta = item.details?.[0];
  const metaRight = item.details?.[1];
  const isInternal = item.href?.startsWith("/");
  const isHttp = !!item.href && /^https?:/.test(item.href);
  const shouldEscapePreviewFrame = item.href?.includes("instagram.com") ?? false;
  const CTA: React.ElementType = isInternal ? Link : "a";
  const ctaProps: Record<string, unknown> = isInternal
    ? { to: item.href! }
    : {
        href: item.href ?? "#",
        target: isHttp ? (shouldEscapePreviewFrame ? "_top" : "_blank") : undefined,
        rel: isHttp && !shouldEscapePreviewFrame ? "noopener noreferrer" : undefined,
      };

  const [qrOpen, setQrOpen] = useState(false);

  useEffect(() => {
    if (!qrOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setQrOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [qrOpen]);

  return (
    <>
      <article className="pk-card" style={style}>
        {item.backgroundImage && (
          <button
            type="button"
            className="pk-card__qr-btn"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setQrOpen(true);
            }}
            aria-label="Enlarge QR code"
          >
            <img
              src={item.backgroundImage}
              alt="Scan QR"
              className="pk-card__qr"
              loading="lazy"
              decoding="async"
            />
          </button>
        )}

        <div className="pk-card__num">{num}</div>
        <div className="pk-card__icon">{item.icon}</div>
        <div className="pk-card__eyebrow">PY Kidda Hub</div>
        <h3 className="pk-card__title">{item.title}</h3>
        <div className="pk-card__sub">{item.eyebrow}</div>
        <p className="pk-card__desc">{item.description}</p>
        {(meta || metaRight) && (
          <div className="pk-card__meta">
            <span className="pk-card__meta-left">{meta}</span>
            {metaRight && <span className="pk-card__meta-right">{metaRight}</span>}
          </div>
        )}
        <CTA className="pk-card__cta" {...ctaProps}>
          <span>{item.actionLabel}</span>
          <span aria-hidden="true"><ArrowRight size={18} /></span>
        </CTA>
      </article>

      {qrOpen && item.backgroundImage && (
        <div
          className="pk-qr-modal"
          role="dialog"
          aria-modal="true"
          aria-label="QR code"
          onClick={() => setQrOpen(false)}
        >
          <div className="pk-qr-modal__inner" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="pk-qr-modal__close"
              onClick={() => setQrOpen(false)}
              aria-label="Close"
            >
              <X size={22} />
            </button>
            <img
              src={item.backgroundImage}
              alt="Scan QR code"
              className="pk-qr-modal__img"
            />
            <p className="pk-qr-modal__caption">Scan with your camera to open</p>
          </div>
        </div>
      )}
    </>
  );
}


function Carousel({ items }: { items: DashboardCardItem[] }) {
  // Duplicate list for a seamless left-to-right marquee loop
  const doubled = [...items, ...items];

  return (
    <div className="pk-carousel">
      <div className="pk-carousel__track">
        {doubled.map((item, i) => (
          <Card key={`${item.id}-${i}`} item={item} index={i % items.length} />
        ))}
      </div>
      
    </div>
  );
}

export default function PyKiddaDashboard() {
  return (
    <main className="pk-dash">
      <section className="pk-dash__section">
        <div className="pk-dash__head">
          <div>
            <div className="pk-dash__eyebrow">Explore your workspace</div>
            <h2 className="pk-dash__title">
              Everything you need to <em>grow</em>
            </h2>
          </div>
          <p className="pk-dash__sub">
            Choose a feature and take the next small step in your Python journey.
          </p>
        </div>
        <Carousel items={learningCards} />
      </section>

      <section className="pk-dash__section">
        <div className="pk-dash__head">
          <div>
            <div className="pk-dash__eyebrow">Stay connected</div>
            <h2 className="pk-dash__title">
              Let's keep in <em>touch</em>
            </h2>
          </div>
          <p className="pk-dash__sub">
            Follow the community or reach our team whenever you need help on your Python journey.
          </p>
        </div>
        <Carousel items={contactCards} />
      </section>

      <section className="pk-dash__section">
        <div className="pk-dash__head">
          <div>
            <div className="pk-dash__eyebrow">Built with care</div>
            <h2 className="pk-dash__title">
              Why use <em>PY Kidda</em>?
            </h2>
          </div>
          <p className="pk-dash__sub">
            A safe, thoughtful learning space designed around real students and real teachers.
          </p>
        </div>
        <Carousel items={whyPyKiddaCards} />
      </section>
    </main>
  );
}

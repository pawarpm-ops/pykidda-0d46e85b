import { Link } from "@tanstack/react-router";
import { ArrowRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

function Card({
  item,
  index,
  onQrOpen,
}: {
  item: DashboardCardItem;
  index: number;
  onQrOpen: (image: string) => void;
}) {
  const style = { ["--pk-accent" as string]: COLOR_MAP[item.color] ?? "var(--pk-orange)" } as React.CSSProperties;
  const num = String(index + 1).padStart(2, "0");
  const meta = item.details?.[0];
  const metaRight = item.details?.[1];
  const isInternal = item.href?.startsWith("/");
  const isHttp = !!item.href && /^https?:/.test(item.href);
  const shouldEscapePreviewFrame = item.href?.includes("instagram.com") ?? false;
  const qrImage = item.backgroundImage;
  const CTA: React.ElementType = isInternal ? Link : "a";
  const ctaProps: Record<string, unknown> = isInternal
    ? { to: item.href! }
    : {
        href: item.href ?? "#",
        target: isHttp ? (shouldEscapePreviewFrame ? "_top" : "_blank") : undefined,
        rel: isHttp && !shouldEscapePreviewFrame ? "noopener noreferrer" : undefined,
      };
  return (
    <article className="pk-card" style={style}>
        {qrImage && (
          <button
            type="button"
            className="pk-card__qr-btn"
            data-qr-image={qrImage}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onQrOpen(qrImage);
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onQrOpen(qrImage);
            }}
            aria-label="Enlarge QR code"
          >
            <img
              src={qrImage}
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
  );
}


function Carousel({
  items,
  onQrOpen,
}: {
  items: DashboardCardItem[];
  onQrOpen: (image: string) => void;
}) {
  // Duplicate list for a seamless left-to-right marquee loop
  const doubled = [...items, ...items];
  const trackRef = useRef<HTMLDivElement | null>(null);
  const offsetRef = useRef(0); // negative = shifted left
  const halfWidthRef = useRef(0);
  const draggingRef = useRef(false);
  const hoveringRef = useRef(false);
  const lastXRef = useRef(0);
  const lastTsRef = useRef<number | null>(null);
  const SPEED = 40; // px per second, left-to-right drift

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const measure = () => {
      halfWidthRef.current = track.scrollWidth / 2;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(track);

    let raf = 0;
    const tick = (ts: number) => {
      const last = lastTsRef.current ?? ts;
      const dt = (ts - last) / 1000;
      lastTsRef.current = ts;
      if (!draggingRef.current && halfWidthRef.current > 0) {
        // Auto drift: content moves left-to-right visually => translateX increases toward 0 from -half
        offsetRef.current += SPEED * dt;
      }
      const half = halfWidthRef.current || 1;
      // Wrap into (-half, 0]
      let o = offsetRef.current % half;
      if (o > 0) o -= half;
      offsetRef.current = o;
      track.style.transform = `translate3d(${o}px, 0, 0)`;
      raf = requestAnimationFrame(tick);
    };
    // seed offset at -half so we have room to drift right
    offsetRef.current = -(track.scrollWidth / 2);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [items]);

  const onPointerDown = (e: React.PointerEvent) => {
    draggingRef.current = true;
    lastXRef.current = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - lastXRef.current;
    lastXRef.current = e.clientX;
    offsetRef.current += dx;
  };
  const endDrag = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
  };

  return (
    <div className="pk-carousel">
      <div
        ref={trackRef}
        className="pk-carousel__track pk-carousel__track--js"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
      >
        {doubled.map((item, i) => (
          <Card key={`${item.id}-${i}`} item={item} index={i % items.length} onQrOpen={onQrOpen} />
        ))}
      </div>
    </div>
  );
}

export default function PyKiddaDashboard() {
  const [activeQrImage, setActiveQrImage] = useState<string | null>(null);
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const qrOpenedAtRef = useRef(0);

  useEffect(() => {
    setPortalHost(document.body);
  }, []);

  useEffect(() => {
    if (!activeQrImage) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveQrImage(null);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [activeQrImage]);

  const openQr = (image: string) => {
    qrOpenedAtRef.current = Date.now();
    setActiveQrImage(image);
  };

  const closeQr = () => setActiveQrImage(null);

  useEffect(() => {
    const openFromPointer = (event: PointerEvent) => {
      const hit = document.elementFromPoint(event.clientX, event.clientY);
      const button = hit?.closest?.(".pk-card__qr-btn");
      if (!(button instanceof HTMLElement)) return;
      const image = button.dataset.qrImage;
      if (!image) return;

      event.preventDefault();
      event.stopPropagation();
      openQr(image);
    };

    document.addEventListener("pointerdown", openFromPointer, true);
    return () => document.removeEventListener("pointerdown", openFromPointer, true);
  }, []);

  return (
    <>
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
          <Carousel items={learningCards} onQrOpen={openQr} />
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
          <Carousel items={contactCards} onQrOpen={openQr} />
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
          <Carousel items={whyPyKiddaCards} onQrOpen={openQr} />
        </section>
      </main>

      {activeQrImage && portalHost && createPortal(
        <div
          className="pk-qr-modal"
          role="dialog"
          aria-modal="true"
          aria-label="QR code"
          onClick={() => {
            if (Date.now() - qrOpenedAtRef.current < 300) return;
            closeQr();
          }}
        >
          <div className="pk-qr-modal__inner" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="pk-qr-modal__close"
              onClick={closeQr}
              aria-label="Close"
            >
              <X size={22} />
            </button>
            <img
              src={activeQrImage}
              alt="Scan QR code"
              className="pk-qr-modal__img"
            />
            <p className="pk-qr-modal__caption">Scan with your camera to open</p>
          </div>
        </div>,
        portalHost,
      )}
    </>
  );
}

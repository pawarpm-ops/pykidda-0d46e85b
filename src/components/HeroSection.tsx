import { useEffect, useRef } from "react";
import { ArrowRight, ClipboardCheck, Rocket } from "lucide-react";
import { Link } from "@tanstack/react-router";
import "./HeroSection.css";

const PYTHON_VIDEO = "/PY_Kidda_first_1_second_smooth_loop.webm";

export default function HeroSection() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;

    const startVideo = async () => {
      try {
        await video.play();
      } catch {
        /* retried on visibility change */
      }
    };
    startVideo();

    const handleVisibilityChange = () => {
      if (!document.hidden && video.paused) startVideo();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  return (
    <section className="py-kidda-hero" aria-labelledby="pk-hero-title">
      {/* Ambient color glows */}
      <div
        className="py-kidda-hero__glow py-kidda-hero__glow--left"
        aria-hidden="true"
      />
      <div
        className="py-kidda-hero__glow py-kidda-hero__glow--right"
        aria-hidden="true"
      />

      {/* Right-side transparent Python animation */}
      <div className="py-kidda-hero__video-layer" aria-hidden="true">
        <video
          ref={videoRef}
          className="py-kidda-hero__video"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          controls={false}
          poster=""
          onCanPlay={(event) => {
            event.currentTarget.muted = true;
            event.currentTarget.play().catch(() => undefined);
          }}
        >
          <source src={PYTHON_VIDEO} type="video/webm" />
        </video>
      </div>

      {/* Darken overlay to keep text readable */}
      <div className="py-kidda-hero__overlay" aria-hidden="true" />

      {/* Hero content (centered) */}
      <div className="py-kidda-hero__content">
        <div className="py-kidda-hero__label">
          <span className="py-kidda-hero__label-dot" />
          Your Python Journey Starts Here
        </div>

        <h1 id="pk-hero-title" className="py-kidda-hero__title">
          <span className="block">Be a</span>
          <span className="block py-kidda-hero__title-highlight">PY Kidda</span>
          <span className="block">with Us</span>
        </h1>

        <p className="py-kidda-hero__description">
          Learn Python. Solve challenges. Build real skills.
        </p>

        <div className="py-kidda-hero__actions">
          <Link
            to="/practice"
            className="py-kidda-hero__button py-kidda-hero__button--primary"
          >
            <Rocket size={18} aria-hidden="true" />
            <span>Start Learning</span>
            <ArrowRight
              className="py-kidda-hero__button-arrow"
              size={17}
              aria-hidden="true"
            />
          </Link>
          <Link
            to="/mock-tests"
            className="py-kidda-hero__button py-kidda-hero__button--secondary"
          >
            <ClipboardCheck size={18} aria-hidden="true" />
            <span>Take a Mock Test</span>
          </Link>
        </div>

        <p className="py-kidda-hero__motto">Learn · Code · Grow</p>
      </div>
    </section>
  );
}

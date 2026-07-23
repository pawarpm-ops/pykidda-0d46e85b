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
        // Autoplay will be attempted again when the page becomes active.
      }
    };

    startVideo();

    const handleVisibilityChange = () => {
      if (!document.hidden && video.paused) {
        startVideo();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <section className="py-kidda-hero">
      {/* Background colour effects */}
      <div
        className="py-kidda-hero__glow py-kidda-hero__glow--left"
        aria-hidden="true"
      />
      <div
        className="py-kidda-hero__glow py-kidda-hero__glow--right"
        aria-hidden="true"
      />

      {/* Transparent Python animation */}
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

      {/* Readability overlay */}
      <div className="py-kidda-hero__overlay" aria-hidden="true" />

      {/* Hero content */}
      <div className="py-kidda-hero__content">
        <div className="py-kidda-hero__label">
          <span className="py-kidda-hero__label-dot" />
          Learn • Practise • Code
        </div>

        <h1 className="py-kidda-hero__title">
          Be a{" "}
          <span className="py-kidda-hero__title-highlight">PY Kidda</span>{" "}
          with Us
        </h1>

        <p className="py-kidda-hero__description">
          Learn Python, solve challenges and build real coding skills
          through one student-friendly platform.
        </p>

        <div className="py-kidda-hero__actions">
          <Link
            to="/practice"
            className="py-kidda-hero__button py-kidda-hero__button--primary"
          >
            <Rocket size={19} aria-hidden="true" />
            <span>Start Learning</span>
            <ArrowRight
              className="py-kidda-hero__button-arrow"
              size={18}
              aria-hidden="true"
            />
          </Link>
          <Link
            to="/mock-tests"
            className="py-kidda-hero__button py-kidda-hero__button--secondary"
          >
            <ClipboardCheck size={19} aria-hidden="true" />
            <span>Take a Mock Test</span>
          </Link>
        </div>

        <p className="py-kidda-hero__motto">{"{ Learn • Practise • Code }"}</p>
      </div>
    </section>
  );
}

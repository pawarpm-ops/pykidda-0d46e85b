import { useEffect, useRef, useState } from "react";
import { useRouterState, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

const INACTIVITY_LIMIT = 60 * 60 * 1000; // 60 min
const WARNING_TIME = 55 * 60 * 1000; // 55 min → warn (5 min countdown)

function isExamRoute(pathname: string) {
  return (
    pathname.includes("/mock-tests/") &&
    (pathname.endsWith("/run") || pathname.includes("/warning"))
  );
}

export function InactivityLogout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [warn, setWarn] = useState(false);
  const [countdown, setCountdown] = useState(300); // seconds
  const warnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  const clearAll = () => {
    if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  };

  const doLogout = async () => {
    try {
      sessionStorage.setItem("pk:logout-reason", "You were logged out due to inactivity.");
      await supabase.auth.signOut();
    } finally {
      navigate({ to: "/auth", replace: true });
    }
  };

  const resetTimers = () => {
    if (isExamRoute(pathRef.current)) {
      // don't run AFK during exams
      clearAll();
      setWarn(false);
      return;
    }
    clearAll();
    setWarn(false);
    warnTimerRef.current = setTimeout(() => {
      if (isExamRoute(pathRef.current)) return;
      setWarn(true);
      setCountdown(300);
      countdownRef.current = setInterval(() => {
        setCountdown((c) => (c > 0 ? c - 1 : 0));
      }, 1000);
    }, WARNING_TIME);
    logoutTimerRef.current = setTimeout(() => {
      if (isExamRoute(pathRef.current)) return;
      void doLogout();
    }, INACTIVITY_LIMIT);
  };

  useEffect(() => {
    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"];
    const onActivity = () => resetTimers();
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    resetTimers();
    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      clearAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // reset on route change
  useEffect(() => {
    resetTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!warn) return null;

  const m = Math.floor(countdown / 60);
  const s = countdown % 60;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <style>{`
        @keyframes pk-sleep { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
      `}</style>
      <div className="relative w-full max-w-md rounded-3xl border border-white/15 bg-slate-900/95 p-8 text-center shadow-2xl">
        <div className="absolute -inset-0.5 -z-10 rounded-3xl bg-gradient-to-br from-cyan-500/40 to-amber-500/40 blur-2xl" />
        <div
          className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-700 text-5xl shadow-xl"
          style={{ animation: "pk-sleep 2s ease-in-out infinite" }}
        >
          😴
        </div>
        <h2 className="mt-4 text-2xl font-black text-white">Still there, coder?</h2>
        <p className="mt-2 text-sm text-white/70">
          You've been inactive for a long time. For security, you will be logged out in
        </p>
        <p className="my-4 text-5xl font-black tabular-nums text-yellow-300">
          {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={() => resetTimers()}
            className="rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-2.5 text-sm font-bold text-slate-900 shadow-lg transition hover:scale-105"
          >
            Stay Logged In
          </button>
          <button
            onClick={() => void doLogout()}
            className="rounded-xl border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Logout Now
          </button>
        </div>
      </div>
    </div>
  );
}

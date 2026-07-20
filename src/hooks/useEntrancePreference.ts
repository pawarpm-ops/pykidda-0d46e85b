import { useEffect, useState } from "react";

const KEY = "pykidda_entrance_v1_seen";

export function hasSeenEntrance(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.sessionStorage.getItem(KEY) === "1";
  } catch {
    return true;
  }
}

export function markEntranceSeen() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, "1");
  } catch {
    /* ignore */
  }
}

export function clearEntranceSeen() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useEntrancePreference(forceReplay = false) {
  // Start false on server to avoid hydration mismatch; decide after mount.
  const [shouldPlay, setShouldPlay] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
    if (forceReplay) {
      setShouldPlay(true);
      return;
    }
    if (!hasSeenEntrance()) setShouldPlay(true);
  }, [forceReplay]);

  return {
    ready,
    shouldPlay,
    dismiss: () => {
      markEntranceSeen();
      setShouldPlay(false);
    },
  };
}

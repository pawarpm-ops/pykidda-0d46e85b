// In-memory memoization of supabase.auth.getUser() / getSession() to prevent
// components from independently hitting Supabase Auth on every mount.
//
// Symptom this fixes: 10+ parallel GET /user requests within a few seconds
// after a single login, one per component that calls supabase.auth.getUser()
// on mount (NotificationBell, StreakCard, ReviewPopup, etc.). Each is small
// but together they add ~200-400ms of noise to the "Slow page load" metric
// and pointlessly hammer the auth server.
//
// Behavior:
// - First call resolves via the real Supabase client.
// - Subsequent calls within TTL_MS return the cached result (single promise).
// - Any auth state change (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, etc.)
//   invalidates the cache immediately.

import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

const TTL_MS = 5_000;

type Cached<T> = { at: number; promise: Promise<T> } | null;

let userCache: Cached<{ data: { user: User | null } }> = null;
let sessionCache: Cached<{ data: { session: Session | null } }> = null;

function fresh<T>(c: Cached<T>): c is { at: number; promise: Promise<T> } {
  return !!c && Date.now() - c.at < TTL_MS;
}

export function getCachedUser() {
  if (fresh(userCache)) return userCache.promise;
  const promise = supabase.auth.getUser().then((r) => ({ data: { user: r.data.user } }));
  userCache = { at: Date.now(), promise };
  // On error, drop the cache so the next caller retries.
  promise.catch(() => {
    userCache = null;
  });
  return promise;
}

export function getCachedSession() {
  if (fresh(sessionCache)) return sessionCache.promise;
  const promise = supabase.auth
    .getSession()
    .then((r) => ({ data: { session: r.data.session } }));
  sessionCache = { at: Date.now(), promise };
  promise.catch(() => {
    sessionCache = null;
  });
  return promise;
}

export function invalidateAuthCache() {
  userCache = null;
  sessionCache = null;
}

// Invalidate whenever Supabase says auth state changed (login, logout, refresh).
if (typeof window !== "undefined") {
  try {
    supabase.auth.onAuthStateChange(() => {
      invalidateAuthCache();
    });
  } catch {
    /* no-op */
  }
}

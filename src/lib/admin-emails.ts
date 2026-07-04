// Client-side admin allowlist used ONLY for UI hints (opt-out onboarding,
// fast-path role check). Real authorization lives in RLS via user_roles +
// public.has_role — this list can never grant real admin access.
export const ADMIN_EMAILS = [
  "siddhustudyhard@gmail.com",
  "minakshee2000@gmail.com",
  "vvjadhav@coe.sveri.ac.in",
] as const;

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const e = email.toLowerCase();
  return ADMIN_EMAILS.some((a) => a === e);
}

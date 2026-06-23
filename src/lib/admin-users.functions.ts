import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type StudentAuthInfo = {
  user_id: string;
  email: string | null;
  email_confirmed_at: string | null;
  phone: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  updated_at: string | null;
  providers: string[];
  is_banned: boolean;
  sign_in_count: number;
};

export const listStudentAuthInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StudentAuthInfo[]> => {
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Paginate through all users
    const all: StudentAuthInfo[] = [];
    let page = 1;
    const perPage = 200;
    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (error) throw new Error(error.message);
      const users = data?.users ?? [];
      for (const u of users) {
        const identities = (u.identities ?? []) as Array<{ provider?: string }>;
        const providers = Array.from(
          new Set(identities.map((i) => i.provider).filter((p): p is string => !!p)),
        );
        const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
        const appMeta = (u.app_metadata ?? {}) as Record<string, unknown>;
        const signInCount =
          typeof meta.sign_in_count === "number"
            ? (meta.sign_in_count as number)
            : typeof appMeta.sign_in_count === "number"
              ? (appMeta.sign_in_count as number)
              : 0;
        all.push({
          user_id: u.id,
          email: u.email ?? null,
          email_confirmed_at: u.email_confirmed_at ?? null,
          phone: u.phone ?? null,
          created_at: u.created_at ?? null,
          last_sign_in_at: u.last_sign_in_at ?? null,
          updated_at: u.updated_at ?? null,
          providers,
          is_banned: Boolean((u as { banned_until?: string }).banned_until),
          sign_in_count: signInCount,
        });
      }
      if (users.length < perPage) break;
      page += 1;
      if (page > 25) break; // safety
    }
    return all;
  });

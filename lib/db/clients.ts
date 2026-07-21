import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

/**
 * Supabase client factories. Server-only.
 *
 * - `supabaseServer()` is user-scoped: it reads the auth cookie, so RLS applies
 *   and `auth.getUser()` resolves the caller. Used for all domain reads/writes.
 * - `supabaseService()` uses the service-role key and BYPASSES RLS. Reserved
 *   for the rare cross-cutting operation that legitimately needs it; callers
 *   MUST authorize ownership themselves before using it.
 */

// Derive the client type from the factory's own return type so it always
// matches the installed SDK's generic signature exactly.
export type Db = ReturnType<typeof createServerClient<Database>>;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

/** User-scoped client bound to the request's auth cookie (RLS enforced). */
export function supabaseServer(): Db {
  const cookieStore = cookies();
  return createServerClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>,
        ) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component without a writable cookie store;
            // safe to ignore — the session is refreshed by middleware instead.
          }
        },
      },
    },
  );
}

/** Service-role client. BYPASSES RLS — authorize ownership before every use. */
export function supabaseService(): Db {
  return createClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

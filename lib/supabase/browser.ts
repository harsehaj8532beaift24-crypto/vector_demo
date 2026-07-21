import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/db/database.types";

/**
 * Browser Supabase client — auth only. The frontend uses this to sign in/out
 * and read the session; all domain data goes through the typed API client
 * (which talks to our route handlers), never Supabase's auto-REST directly.
 */
let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function supabaseBrowser() {
  if (!client) {
    client = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return client;
}

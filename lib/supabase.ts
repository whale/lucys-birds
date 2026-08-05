import { createClient } from "@supabase/supabase-js";

// Server-side only. The service role key bypasses row-level security, so this
// module must never be imported from a "use client" file. Next.js will not stop
// you — the import just silently ships the key to the browser.
export const RECORDINGS_BUCKET = "recordings";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    // Fail loudly at the first call rather than returning a client that 401s
    // on every query with nothing pointing at the cause.
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

export function serviceClient() {
  return createClient(
    required("SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { persistSession: false },
    },
  );
}

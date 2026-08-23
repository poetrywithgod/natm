import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export type { Session } from "@supabase/supabase-js";

export function createSupabaseClient(url: string, anonKey: string) {
  return createClient<Database>(url, anonKey);
}

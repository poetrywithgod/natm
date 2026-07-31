import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export function createSupabaseClient(url: string, anonKey: string) {
  return createClient<Database>(url, anonKey);
}

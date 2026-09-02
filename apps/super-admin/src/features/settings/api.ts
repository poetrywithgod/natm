import { supabase } from "../../lib/supabase";

export interface PlatformSettings {
  id: string;
  default_term_1_fee: number | null;
  default_term_2_fee: number | null;
  default_term_3_fee: number | null;
  maintenance_mode: boolean;
  maintenance_message: string | null;
  updated_at: string;
}

export async function fetchPlatformSettings(): Promise<PlatformSettings> {
  const { data, error } = await supabase.from("platform_settings").select("*").eq("id", "default").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updatePlatformSettings(
  updates: Partial<
    Pick<
      PlatformSettings,
      "default_term_1_fee" | "default_term_2_fee" | "default_term_3_fee" | "maintenance_mode" | "maintenance_message"
    >
  >
): Promise<void> {
  const { error } = await supabase
    .from("platform_settings")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", "default");
  if (error) throw new Error(error.message);
}

import { supabase } from "../../lib/supabase";

export type IntegrationStatus = "not_configured" | "blocked" | "configured" | "working";

export interface Integration {
  id: string;
  label: string;
  status: IntegrationStatus;
  notes: string | null;
  last_checked_at: string | null;
  updated_at: string;
}

export async function fetchIntegrations(): Promise<Integration[]> {
  const { data, error } = await supabase.from("system_integrations").select("*").order("id");
  if (error) throw new Error(error.message);
  return (data ?? []) as Integration[];
}

// Manual status board update -- used for the integrations that can't be
// checked programmatically (Remita has no merchant account to ping yet,
// SMTP delivery can't be confirmed without actually receiving an email).
export async function updateIntegration(id: string, status: IntegrationStatus, notes: string): Promise<void> {
  const { error } = await supabase
    .from("system_integrations")
    .update({ status, notes, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

async function parseFunctionError(error: unknown, fallback: string): Promise<Error> {
  const response = (error as { context?: Response } | null)?.context;
  if (response) {
    try {
      const body = await response.json();
      if (body?.error) return new Error(body.error);
    } catch {
      // response wasn't JSON -- fall through to the generic message
    }
  }
  return new Error(error instanceof Error ? error.message : fallback);
}

// The one integration with a real live check -- makes a minimal Anthropic
// API call server-side and updates the "anthropic" row with the result.
export async function testAnthropicConnection(): Promise<{
  status: IntegrationStatus;
  notes: string;
  last_checked_at: string;
}> {
  const { data, error } = await supabase.functions.invoke("test-anthropic-connection", {});
  if (error) throw await parseFunctionError(error, "Failed to test the Anthropic connection");
  if (data?.error) throw new Error(data.error);
  return data;
}

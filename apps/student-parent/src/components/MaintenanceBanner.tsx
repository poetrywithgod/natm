import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { supabase } from "../lib/supabase";

// Informational only -- reads platform_settings once on load and shows a
// banner if Super Admin has maintenance_mode on. Deliberately doesn't
// block or gate anything: an incident banner that could also lock out
// the person trying to fix the incident is a worse failure mode than a
// banner that's occasionally stale for a few minutes.
export default function MaintenanceBanner() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await supabase
          .from("platform_settings")
          .select("maintenance_mode, maintenance_message")
          .eq("id", "default")
          .maybeSingle();
        if (data?.maintenance_mode) {
          setMessage(data.maintenance_message?.trim() || "The platform is undergoing maintenance.");
        }
      } catch {
        // Non-critical -- if this fails, simply show no banner.
      }
    }
    load();
  }, []);

  if (!message) return null;

  return (
    <div className="bg-warning/15 border-b border-warning/30 px-4 py-2 flex items-center gap-2 justify-center text-center">
      <AlertTriangle size={14} className="text-warning shrink-0" />
      <p className="font-ui text-xs text-warning">{message}</p>
    </div>
  );
}

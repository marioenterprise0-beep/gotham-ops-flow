import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/lib/role";

const LS_KEY = "gotham:alerts:lastSeenAt";

function getLastSeen(): string {
  if (typeof window === "undefined") return new Date(0).toISOString();
  return localStorage.getItem(LS_KEY) ?? new Date(0).toISOString();
}

export function markAlertsSeen() {
  try {
    localStorage.setItem(LS_KEY, new Date().toISOString());
    window.dispatchEvent(new Event("gotham:alerts-seen"));
  } catch {}
}

export function useUnreadAlerts() {
  const { session, loading } = useRole();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (loading || !session?.access_token) { setCount(0); return; }
    let cancelled = false;

    const refresh = async () => {
      const since = getLastSeen();
      const { count: c } = await supabase
        .from("alerts")
        .select("id", { count: "exact", head: true })
        .neq("status", "resolved")
        .gt("created_at", since);
      if (!cancelled) setCount(c ?? 0);
    };

    refresh();

    const channel = supabase
      .channel("alerts-unread-badge")
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, refresh)
      .subscribe();

    const onSeen = () => refresh();
    window.addEventListener("gotham:alerts-seen", onSeen);

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      window.removeEventListener("gotham:alerts-seen", onSeen);
    };
  }, [loading, session?.access_token]);

  return count;
}

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/lib/role";

export type PushPermission = "default" | "granted" | "denied" | "unsupported";

function isSupported() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator
  );
}

async function registerSW(): Promise<ServiceWorkerRegistration | null> {
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

function showNotification(
  reg: ServiceWorkerRegistration,
  title: string,
  body: string,
  priority: string,
  url = "/alerts",
) {
  reg.showNotification(title, {
    body,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: `gotham-${Date.now()}`,
    data: { url },
    requireInteraction: priority === "critical",
  });
}

// Fires a browser notification when a new alert arrives via the real-time
// subscription and the tab is in the background.
export function usePushNotifications() {
  const { session, loading, roleId } = useRole();
  const [permission, setPermission] = useState<PushPermission>(() => {
    if (!isSupported()) return "unsupported";
    return Notification.permission as PushPermission;
  });
  const regRef = useRef<ServiceWorkerRegistration | null>(null);

  // Register service worker once on mount.
  useEffect(() => {
    if (!isSupported()) return;
    registerSW().then((reg) => { regRef.current = reg; });
    setPermission(Notification.permission as PushPermission);
  }, []);

  // Subscribe to real-time alert inserts and fire notifications when the
  // page is hidden (user switched tabs or locked phone).
  useEffect(() => {
    if (loading || !session?.access_token || permission !== "granted") return;
    const isManagerOrOwner = roleId === "owner" || roleId === "manager";

    const channel = supabase
      .channel("push-alerts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alerts" },
        (payload) => {
          // Only notify if page is hidden so we don't double-alert.
          if (document.visibilityState !== "hidden") return;
          // Crew only gets notified about announcements; managers get everything.
          const alert = payload.new as any;
          const isAnnouncement =
            alert.source_module === "announcements" || alert.type === "announcement";
          if (!isManagerOrOwner && !isAnnouncement) return;

          const reg = regRef.current;
          if (!reg) return;
          showNotification(
            reg,
            alert.title ?? "New alert",
            alert.description ?? `Priority: ${alert.priority}`,
            alert.priority ?? "normal",
            "/alerts",
          );
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loading, session?.access_token, permission, roleId]);

  const requestPermission = async (): Promise<PushPermission> => {
    if (!isSupported()) return "unsupported";
    if (permission === "granted") return "granted";

    // Register service worker before requesting permission so the SW is ready
    // to handle showNotification.
    if (!regRef.current) regRef.current = await registerSW();

    const result = await Notification.requestPermission();
    setPermission(result as PushPermission);
    return result as PushPermission;
  };

  return { permission, requestPermission };
}

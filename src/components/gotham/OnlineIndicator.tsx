import { useEffect, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";

export function OnlineIndicator() {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  if (online) return null;
  return (
    <div className="fixed bottom-20 lg:bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-[var(--color-danger)] text-white px-3 py-1.5 text-xs font-medium shadow-lg">
      <WifiOff className="h-3.5 w-3.5" />
      Offline — changes will retry when you reconnect
    </div>
  );
}

export function OnlineDot() {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return (
    <span
      title={online ? "Online" : "Offline"}
      className="inline-flex items-center gap-1.5 text-xs text-white/70"
    >
      {online ? <Wifi className="h-3.5 w-3.5 text-[var(--color-success)]" /> : <WifiOff className="h-3.5 w-3.5 text-[var(--color-danger)]" />}
    </span>
  );
}

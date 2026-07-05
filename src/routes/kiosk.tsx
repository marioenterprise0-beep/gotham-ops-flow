import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState, useCallback } from "react";
import {
  kioskWhoAmI, kioskListEmployees, kioskClockIn, kioskClockOut,
} from "@/lib/kiosk.functions";
import { Button } from "@/components/ui/button";
import { Clock, LogIn, LogOut, ArrowLeft, Delete, CheckCircle2, XCircle } from "lucide-react";

const TOKEN_KEY = "gotham:kiosk-device-token:v1";

export const Route = createFileRoute("/kiosk")({
  ssr: false,
  component: KioskPage,
  head: () => ({ meta: [{ title: "Gotham Halal · Kiosk" }] }),
});

function KioskPage() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    setToken(localStorage.getItem(TOKEN_KEY));
  }, []);

  if (token === null) {
    return <FullScreenCenter><div className="text-white/60">Loading…</div></FullScreenCenter>;
  }
  if (!token) return <NotRegistered />;
  return <KioskAuthed token={token} onReset={() => { localStorage.removeItem(TOKEN_KEY); setToken(""); }} />;
}

function NotRegistered() {
  return (
    <FullScreenCenter>
      <div className="text-center max-w-md space-y-4 px-6">
        <div className="text-6xl">🔒</div>
        <h1 className="text-3xl font-bold text-white">This iPad isn't registered</h1>
        <p className="text-white/70">
          An owner must sign in and register this device before the kiosk can be used.
          Go to <span className="font-mono text-gold">Trusted Devices</span> in the app,
          sign in as owner, and tap "Register this device".
        </p>
      </div>
    </FullScreenCenter>
  );
}

function KioskAuthed({ token, onReset }: { token: string; onReset: () => void }) {
  const whoFn = useServerFn(kioskWhoAmI);
  const listFn = useServerFn(kioskListEmployees);
  const clockInFn = useServerFn(kioskClockIn);
  const clockOutFn = useServerFn(kioskClockOut);

  const who = useQuery({
    queryKey: ["kiosk", "who", token],
    queryFn: () => whoFn({ data: { deviceToken: token } }),
    retry: false,
  });
  const roster = useQuery({
    queryKey: ["kiosk", "roster", token],
    queryFn: () => listFn({ data: { deviceToken: token } }),
    refetchInterval: 15000,
    enabled: who.data?.ok === true,
  });

  const [pickedId, setPickedId] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [flash, setFlash] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const picked = roster.data?.find((e) => e.id === pickedId) ?? null;
  const mode: "in" | "out" | null = picked ? (picked.isOpen ? "out" : "in") : null;

  const reset = useCallback(() => {
    setPickedId(null);
    setPin("");
  }, []);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => {
      setFlash(null);
      reset();
      roster.refetch();
    }, 2500);
    return () => clearTimeout(t);
  }, [flash, reset, roster]);

  // Auto-return to roster if user idles on PIN screen
  useEffect(() => {
    if (!pickedId || flash) return;
    const t = setTimeout(reset, 30000);
    return () => clearTimeout(t);
  }, [pickedId, flash, reset]);

  const submit = useMutation({
    mutationFn: async () => {
      if (!picked || pin.length !== 4) throw new Error("Enter 4 digits");
      let lat: number | undefined, lng: number | undefined, accuracy: number | undefined;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000, maximumAge: 60000 });
        });
        lat = pos.coords.latitude; lng = pos.coords.longitude; accuracy = pos.coords.accuracy;
      } catch { /* kiosk without geo — server injects trailer coords */ }
      if (mode === "in") {
        return clockInFn({ data: { deviceToken: token, employeeId: picked.id, pin, lat, lng, accuracy } });
      }
      return clockOutFn({ data: { deviceToken: token, employeeId: picked.id, pin } });
    },
    onSuccess: (res) => {
      if (res && "ok" in res && res.ok) {
        setFlash({ kind: "ok", msg: `${res.employeeName} · Clocked ${mode === "in" ? "in" : "out"}` });
      } else {
        setFlash({ kind: "err", msg: (res as any)?.message ?? "Failed" });
        setPin("");
      }
    },
    onError: (e: any) => {
      setFlash({ kind: "err", msg: e?.message ?? "Failed" });
      setPin("");
    },
  });

  if (who.isLoading) {
    return <FullScreenCenter><div className="text-white/60">Verifying device…</div></FullScreenCenter>;
  }
  if (who.data && !who.data.ok) {
    return (
      <FullScreenCenter>
        <div className="text-center space-y-4">
          <XCircle className="w-16 h-16 mx-auto text-red-400" />
          <div className="text-2xl text-white">{who.data.message}</div>
          <Button size="lg" variant="secondary" onClick={onReset}>Reset device</Button>
        </div>
      </FullScreenCenter>
    );
  }

  const trailerName = who.data?.ok ? who.data.trailer?.name : "";
  const deviceLabel = who.data?.ok ? who.data.device.label : "";

  if (flash) {
    return (
      <FullScreenCenter>
        <div className={`text-center space-y-6 ${flash.kind === "ok" ? "text-green-300" : "text-red-300"}`}>
          {flash.kind === "ok" ? (
            <CheckCircle2 className="w-32 h-32 mx-auto" />
          ) : (
            <XCircle className="w-32 h-32 mx-auto" />
          )}
          <div className="text-4xl font-bold">{flash.msg}</div>
        </div>
      </FullScreenCenter>
    );
  }

  // PIN entry
  if (picked) {
    return (
      <FullScreenBg>
        <div className="flex-1 flex flex-col max-w-lg mx-auto w-full px-6 py-8">
          <button
            onClick={reset}
            className="flex items-center gap-2 text-white/70 mb-6 text-lg"
          >
            <ArrowLeft className="w-5 h-5" /> Back
          </button>
          <div className="text-center mb-8">
            <div className="text-white/60 text-lg">{mode === "in" ? "Clock In" : "Clock Out"}</div>
            <div className="text-white text-4xl font-bold mt-2">{picked.name}</div>
            <div className="text-white/50 mt-4">Enter your 4-digit PIN</div>
          </div>
          <div className="flex justify-center gap-3 mb-8">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-14 h-14 rounded-2xl border-2 ${
                  pin.length > i ? "bg-gold border-gold" : "border-white/20"
                }`}
              />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3 flex-1 max-h-[420px]">
            {["1","2","3","4","5","6","7","8","9"].map((n) => (
              <KeypadBtn key={n} onClick={() => pin.length < 4 && setPin(pin + n)}>{n}</KeypadBtn>
            ))}
            <KeypadBtn onClick={() => setPin("")}>Clear</KeypadBtn>
            <KeypadBtn onClick={() => pin.length < 4 && setPin(pin + "0")}>0</KeypadBtn>
            <KeypadBtn onClick={() => setPin(pin.slice(0, -1))}><Delete className="w-6 h-6 mx-auto" /></KeypadBtn>
          </div>
          <Button
            size="lg"
            className="mt-6 h-16 text-xl bg-gold hover:bg-gold/90 text-black"
            disabled={pin.length !== 4 || submit.isPending}
            onClick={() => submit.mutate()}
          >
            {submit.isPending ? "…" : mode === "in" ? <><LogIn className="w-6 h-6 mr-2" /> Clock In</> : <><LogOut className="w-6 h-6 mr-2" /> Clock Out</>}
          </Button>
        </div>
      </FullScreenBg>
    );
  }

  // Roster
  return (
    <FullScreenBg>
      <div className="px-8 pt-8 pb-4 flex items-center justify-between">
        <div>
          <div className="text-gold text-sm uppercase tracking-widest">{deviceLabel}</div>
          <h1 className="text-white text-3xl font-bold">{trailerName || "Trailer"}</h1>
        </div>
        <ClockWidget />
      </div>
      <div className="px-8 pb-8 flex-1 overflow-auto">
        {roster.isLoading && <div className="text-white/50 text-center pt-16">Loading crew…</div>}
        {roster.data && roster.data.length === 0 && (
          <div className="text-white/50 text-center pt-16">No active employees assigned to this trailer.</div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {(roster.data ?? []).map((e) => (
            <button
              key={e.id}
              disabled={!e.hasPin}
              onClick={() => setPickedId(e.id)}
              className={`rounded-2xl p-6 text-left transition ${
                e.hasPin
                  ? "bg-white/10 hover:bg-white/20 active:scale-[0.98]"
                  : "bg-white/5 opacity-40 cursor-not-allowed"
              }`}
            >
              <div className="text-white text-xl font-semibold">{e.name}</div>
              <div className={`text-sm mt-2 ${e.isOpen ? "text-green-400" : "text-white/50"}`}>
                {e.isOpen ? "● Clocked in" : "○ Not clocked in"}
              </div>
              {!e.hasPin && <div className="text-xs text-yellow-400 mt-1">PIN not set</div>}
            </button>
          ))}
        </div>
      </div>
    </FullScreenBg>
  );
}

function KeypadBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-2xl text-white text-3xl font-semibold"
    >
      {children}
    </button>
  );
}

function ClockWidget() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="text-right text-white">
      <div className="text-3xl font-mono font-bold">
        {now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
      </div>
      <div className="text-sm text-white/60">
        {now.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}
      </div>
    </div>
  );
}

function FullScreenBg({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 flex flex-col bg-gradient-to-br from-graphite via-black to-graphite">
      {children}
    </div>
  );
}

function FullScreenCenter({ children }: { children: React.ReactNode }) {
  return (
    <FullScreenBg>
      <div className="flex-1 flex items-center justify-center">{children}</div>
    </FullScreenBg>
  );
}

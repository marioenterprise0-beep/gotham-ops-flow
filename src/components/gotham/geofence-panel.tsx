import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, SectionHeader } from "@/components/gotham/primitives";
import {
  listTrailerGeofences,
  setTrailerGeofence,
  geocodeAddress,
} from "@/lib/timeclock.functions";

type Trailer = {
  id: string;
  name: string;
  geofence_lat: number | null;
  geofence_lng: number | null;
  geofence_radius_m: number | null;
};

export function GeofencePanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(listTrailerGeofences);
  const saveFn = useServerFn(setTrailerGeofence);
  const { data: trailers = [] } = useQuery<Trailer[]>({
    queryKey: ["trailer-geofences"],
    queryFn: () => listFn() as any,
  });
  const save = useMutation({
    mutationFn: (v: {
      trailerId: string;
      lat: number | null;
      lng: number | null;
      radiusM: number;
    }) => saveFn({ data: v }),
    onSuccess: () => {
      toast.success("Geofence saved");
      qc.invalidateQueries({ queryKey: ["trailer-geofences"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <SectionHeader eyebrow="Clock-in Geofence" title="Locations" />
      <Card>
        <div className="text-xs text-muted-foreground mb-3">
          Employees can only clock in within the radius of their location. Enter an address, stand
          on-site and tap "Use current location", or type lat/lng directly.
        </div>
        <div className="space-y-4">
          {trailers.length === 0 && (
            <div className="text-sm text-muted-foreground">No locations yet.</div>
          )}
          {trailers.map((t) => (
            <GeofenceRow
              key={t.id}
              trailer={t}
              onSave={(v) => save.mutate({ trailerId: t.id, ...v })}
              pending={save.isPending}
            />
          ))}
        </div>
      </Card>
    </>
  );
}

function GeofenceRow({
  trailer,
  onSave,
  pending,
}: {
  trailer: Trailer;
  onSave: (v: { lat: number | null; lng: number | null; radiusM: number }) => void;
  pending: boolean;
}) {
  const [lat, setLat] = useState<string>(trailer.geofence_lat?.toString() ?? "");
  const [lng, setLng] = useState<string>(trailer.geofence_lng?.toString() ?? "");
  const [radius, setRadius] = useState<number>(trailer.geofence_radius_m ?? 25);
  const [locating, setLocating] = useState(false);
  const [address, setAddress] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const geocodeFn = useServerFn(geocodeAddress);

  function useHere() {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported on this device.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setLocating(false);
        toast.success(`Captured (±${Math.round(pos.coords.accuracy)} m)`);
      },
      (err) => {
        setLocating(false);
        toast.error(err.message || "Could not get location");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function useAddress() {
    if (!address.trim()) {
      toast.error("Enter a street address.");
      return;
    }
    setGeocoding(true);
    try {
      const r = await geocodeFn({ data: { address: address.trim() } });
      setLat(r.lat.toFixed(6));
      setLng(r.lng.toFixed(6));
      toast.success(`Found: ${r.label.slice(0, 70)}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGeocoding(false);
    }
  }

  const latNum = lat.trim() === "" ? null : Number(lat);
  const lngNum = lng.trim() === "" ? null : Number(lng);
  const invalid =
    (latNum !== null && !Number.isFinite(latNum)) ||
    (lngNum !== null && !Number.isFinite(lngNum)) ||
    (latNum === null) !== (lngNum === null);

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold text-sm">{trailer.name}</div>
        <button
          onClick={useHere}
          disabled={locating}
          className="h-8 rounded-md border border-border px-3 text-xs font-semibold uppercase tracking-[1px] disabled:opacity-50"
        >
          {locating ? "Locating…" : "Use current location"}
        </button>
      </div>
      <div className="mb-2 flex gap-2">
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Street address, city, state ZIP"
          className="flex-1 h-9 rounded-md border border-border bg-card px-2 text-sm"
        />
        <button
          onClick={useAddress}
          disabled={geocoding || !address.trim()}
          className="h-9 rounded-md border border-border px-3 text-xs font-semibold uppercase tracking-[1px] disabled:opacity-50"
        >
          {geocoding ? "Looking up…" : "Look up address"}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <div className="label-caps text-muted-foreground mb-1">Latitude</div>
          <input
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            placeholder="40.7128"
            className="w-full h-9 rounded-md border border-border bg-card px-2 text-sm"
          />
        </div>
        <div>
          <div className="label-caps text-muted-foreground mb-1">Longitude</div>
          <input
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            placeholder="-74.0060"
            className="w-full h-9 rounded-md border border-border bg-card px-2 text-sm"
          />
        </div>
        <div>
          <div className="label-caps text-muted-foreground mb-1">Radius (m)</div>
          <input
            type="number"
            min={10}
            max={2000}
            value={radius}
            onChange={(e) => setRadius(Math.max(10, Math.min(2000, Number(e.target.value) || 25)))}
            className="w-full h-9 rounded-md border border-border bg-card px-2 text-sm"
          />
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {trailer.geofence_lat == null
            ? "Not set — geofence disabled for this location."
            : "Geofence active."}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onSave({ lat: null, lng: null, radiusM: radius })}
            disabled={pending || trailer.geofence_lat == null}
            className="h-8 rounded-md border border-border px-3 text-xs font-semibold uppercase tracking-[1px] disabled:opacity-50"
          >
            Disable
          </button>
          <button
            onClick={() => onSave({ lat: latNum, lng: lngNum, radiusM: radius })}
            disabled={pending || invalid || latNum === null || lngNum === null}
            className="h-8 rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-3 text-xs font-semibold uppercase tracking-[1px] disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

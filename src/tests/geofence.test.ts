import { describe, it, expect } from "vitest";

// Pure geofence logic extracted from src/lib/timeclock.functions.ts.
// Tests run in isolation — no Supabase, no React.

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function isWithinGeofence(
  userLat: number,
  userLng: number,
  trailerLat: number,
  trailerLng: number,
  radiusM: number,
  accuracyM = 0,
): { ok: boolean; distM: number; toleranceM: number } {
  const dist = distanceMeters(userLat, userLng, trailerLat, trailerLng);
  const tolerance = Math.min(50, accuracyM);
  return { ok: dist - tolerance <= radiusM, distM: dist, toleranceM: tolerance };
}

// NYC Times Square as a fixed reference point for tests.
const TIMES_SQ = { lat: 40.758, lng: -73.9855 };

// One degree of latitude ≈ 111,139 m. We use small offsets to get exact-ish meters.
const ONE_METER_LAT = 1 / 111139;

describe("distanceMeters", () => {
  it("returns ~0 for identical coordinates", () => {
    expect(distanceMeters(40.758, -73.9855, 40.758, -73.9855)).toBeLessThan(0.01);
  });

  it("returns ~111,139 m for one degree of latitude", () => {
    const d = distanceMeters(0, 0, 1, 0);
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });

  it("is symmetric — A→B equals B→A", () => {
    const d1 = distanceMeters(40.758, -73.9855, 40.761, -73.982);
    const d2 = distanceMeters(40.761, -73.982, 40.758, -73.9855);
    expect(Math.abs(d1 - d2)).toBeLessThan(0.001);
  });

  it("measures ~10 m for a tiny offset", () => {
    const tenMeters = ONE_METER_LAT * 10;
    const d = distanceMeters(TIMES_SQ.lat, TIMES_SQ.lng, TIMES_SQ.lat + tenMeters, TIMES_SQ.lng);
    expect(d).toBeGreaterThan(8);
    expect(d).toBeLessThan(12);
  });

  it("handles antipodal points without NaN", () => {
    const d = distanceMeters(90, 0, -90, 0);
    expect(Number.isFinite(d)).toBe(true);
    expect(d).toBeGreaterThan(19_000_000);
  });
});

describe("isWithinGeofence", () => {
  const trailer = TIMES_SQ;
  const radius = 25; // 25 m default

  it("allows clock-in when exactly at the trailer", () => {
    const r = isWithinGeofence(trailer.lat, trailer.lng, trailer.lat, trailer.lng, radius);
    expect(r.ok).toBe(true);
  });

  it("allows clock-in when inside the radius", () => {
    const nearby = { lat: trailer.lat + ONE_METER_LAT * 10, lng: trailer.lng };
    const r = isWithinGeofence(nearby.lat, nearby.lng, trailer.lat, trailer.lng, radius);
    expect(r.ok).toBe(true);
  });

  it("blocks clock-in when outside the radius with no GPS tolerance", () => {
    const farAway = { lat: trailer.lat + ONE_METER_LAT * 100, lng: trailer.lng };
    const r = isWithinGeofence(farAway.lat, farAway.lng, trailer.lat, trailer.lng, radius, 0);
    expect(r.ok).toBe(false);
    expect(r.distM).toBeGreaterThan(radius);
  });

  it("GPS accuracy tolerance allows borderline clock-in (within 50 m cap)", () => {
    // User is 30 m away, radius is 25, but GPS accuracy of 10 m pushes tolerance to 10 m
    // net check: 30 - 10 = 20 <= 25, should pass
    const thirtyMeters = { lat: trailer.lat + ONE_METER_LAT * 30, lng: trailer.lng };
    const r = isWithinGeofence(
      thirtyMeters.lat,
      thirtyMeters.lng,
      trailer.lat,
      trailer.lng,
      radius,
      10,
    );
    expect(r.ok).toBe(true);
  });

  it("caps tolerance at 50 m regardless of reported accuracy", () => {
    // User is 200 m away. Even with 200 m reported accuracy, tolerance caps at 50 m.
    const twoHundredMeters = { lat: trailer.lat + ONE_METER_LAT * 200, lng: trailer.lng };
    const r = isWithinGeofence(
      twoHundredMeters.lat,
      twoHundredMeters.lng,
      trailer.lat,
      trailer.lng,
      radius,
      200,
    );
    expect(r.toleranceM).toBe(50);
    expect(r.ok).toBe(false); // 200 - 50 = 150 > 25
  });

  it("respects custom radius", () => {
    const fiftyMeters = { lat: trailer.lat + ONE_METER_LAT * 50, lng: trailer.lng };
    expect(
      isWithinGeofence(fiftyMeters.lat, fiftyMeters.lng, trailer.lat, trailer.lng, 25).ok,
    ).toBe(false);
    expect(
      isWithinGeofence(fiftyMeters.lat, fiftyMeters.lng, trailer.lat, trailer.lng, 60).ok,
    ).toBe(true);
  });
});

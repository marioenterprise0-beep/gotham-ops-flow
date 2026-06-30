// Shared timezone helpers used by both server functions and client UI so that
// schedule windows and "clocked hours" calculations match the trailer's local
// time regardless of where the viewer's device is.

export const DEFAULT_TRAILER_TZ = "America/New_York";

/**
 * Returns the UTC instant (ms since epoch) whose wall-clock representation in
 * `tz` is the given calendar date at the start (00:00:00) or end
 * (23:59:59.999) of day.
 *
 * Works in any JS runtime (Cloudflare Workers + browsers) via Intl.
 */
export function zonedDateToUtcMs(
  dateStr: string,
  tz: string | null | undefined,
  endOfDay = false,
): number {
  const zone = tz && tz.length > 0 ? tz : DEFAULT_TRAILER_TZ;
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return NaN;
  const hh = endOfDay ? 23 : 0;
  const mm = endOfDay ? 59 : 0;
  const ss = endOfDay ? 59 : 0;
  const ms = endOfDay ? 999 : 0;
  // Naive UTC guess for that wall-clock time.
  const utcGuess = Date.UTC(y, m - 1, d, hh, mm, ss, ms);
  // What does that UTC instant look like in `tz`?
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(new Date(utcGuess))) {
    if (p.type !== "literal") parts[p.type] = p.value;
  }
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) === 24 ? 0 : Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  const offset = asUTC - utcGuess;
  return utcGuess - offset;
}

/** ISO string of `zonedDateToUtcMs`. */
export function zonedDateToUtcISO(
  dateStr: string,
  tz: string | null | undefined,
  endOfDay = false,
): string {
  return new Date(zonedDateToUtcMs(dateStr, tz, endOfDay)).toISOString();
}

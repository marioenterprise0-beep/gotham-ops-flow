import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Branding = {
  orgName: string;
  shortName: string;
  tagline: string;
  supportEmail: string | null;
  bgColor: string | null;
  fgColor: string | null;
  accentColor: string | null;
  loaded: boolean;
};

const DEFAULTS: Branding = {
  orgName: "Your Organization",
  shortName: "Ops",
  tagline: "Internal operating system for your team.",
  supportEmail: null,
  bgColor: null,
  fgColor: null,
  accentColor: null,
  loaded: false,
};

const BrandingCtx = createContext<Branding>(DEFAULTS);

async function loadBranding(): Promise<Branding> {
  try {
    const { data } = await supabase
      .from("stores")
      .select("name, short_name, tagline, support_email, bg_color, fg_color, accent_color")
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (!data) return { ...DEFAULTS, loaded: true };
    return {
      orgName: data.name || DEFAULTS.orgName,
      shortName: (data as any).short_name?.trim() || data.name || DEFAULTS.shortName,
      tagline: (data as any).tagline?.trim() || DEFAULTS.tagline,
      supportEmail: (data as any).support_email || null,
      bgColor: (data as any).bg_color || null,
      fgColor: (data as any).fg_color || null,
      accentColor: (data as any).accent_color || null,
      loaded: true,
    };
  } catch {
    return { ...DEFAULTS, loaded: true };
  }
}

// Shared color math so applyThemeColors() and preview components resolve
// the exact same surface / border / muted / on-accent values.
const isHex = (v: string | null | undefined): v is string =>
  !!v && /^#[0-9a-fA-F]{6}$/.test(v);
const hexToRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};
const rgbToHex = (r: number, g: number, b: number) =>
  "#" + [r, g, b]
    .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
    .join("");
const luminance = (hex: string) => {
  const { r, g, b } = hexToRgb(hex);
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const mix = (hex: string, target: "white" | "black", amt: number) => {
  const { r, g, b } = hexToRgb(hex);
  const t = target === "white" ? 255 : 0;
  return rgbToHex(r + (t - r) * amt, g + (t - g) * amt, b + (t - b) * amt);
};
const surfaceOf = (base: string, step: number) => {
  const dark = luminance(base) < 0.5;
  return mix(base, dark ? "white" : "black", step);
};

export type ResolvedTheme = {
  background: string;
  foreground: string;
  accent: string;
  onAccent: string;
  accentLight: string;
  sidebar: string;
  card: string;
  popover: string;
  secondary: string;
  muted: string;
  input: string;
  sidebarAccent: string;
  border: string;
  sidebarBorder: string;
  mutedForeground: string;
};

// Single source of truth for the derived theme palette. The live preview and
// the device-preview mocks both consume this so what you see matches exactly
// what applyThemeColors() writes to the global CSS variables.
export function resolveTheme(
  bgColor: string | null | undefined,
  fgColor: string | null | undefined,
  accentColor: string | null | undefined,
): ResolvedTheme {
  const bg = isHex(bgColor) ? bgColor : "#08090B";
  const fg = isHex(fgColor) ? fgColor : "#F5F5F4";
  const ac = isHex(accentColor) ? accentColor : "#22C55E";
  const onAccent = luminance(ac) > 0.5 ? "#0A0A0A" : "#FFFFFF";
  const mutedFg = mix(fg, luminance(bg) < 0.5 ? "black" : "white", 0.35);
  return {
    background: bg,
    foreground: fg,
    accent: ac,
    onAccent,
    accentLight: mix(ac, "white", 0.18),
    sidebar: surfaceOf(bg, 0.03),
    card: surfaceOf(bg, 0.05),
    popover: surfaceOf(bg, 0.07),
    secondary: surfaceOf(bg, 0.08),
    muted: surfaceOf(bg, 0.08),
    input: surfaceOf(bg, 0.09),
    sidebarAccent: surfaceOf(bg, 0.07),
    border: surfaceOf(bg, 0.14),
    sidebarBorder: surfaceOf(bg, 0.14),
    mutedForeground: mutedFg,
  };
}

export function applyThemeColors(b: {
  bgColor: string | null;
  fgColor: string | null;
  accentColor: string | null;
}) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  // Reset any previously-applied inline overrides so a cleared value falls
  // back to the stylesheet defaults cleanly.
  const ALL = [
    "--background", "--foreground",
    "--card", "--card-foreground",
    "--popover", "--popover-foreground",
    "--secondary", "--secondary-foreground",
    "--muted", "--muted-foreground",
    "--accent", "--accent-foreground",
    "--gold", "--gold-light", "--gold-foreground",
    "--primary", "--primary-foreground",
    "--border", "--input", "--ring",
    "--sidebar", "--sidebar-foreground",
    "--sidebar-primary", "--sidebar-primary-foreground",
    "--sidebar-accent", "--sidebar-accent-foreground",
    "--sidebar-border", "--sidebar-ring",
  ];
  for (const name of ALL) root.style.removeProperty(name);

  const set = (name: string, val: string) => root.style.setProperty(name, val);
  const t = resolveTheme(b.bgColor, b.fgColor, b.accentColor);

  if (isHex(b.bgColor)) {
    set("--background", t.background);
    set("--sidebar", t.sidebar);
    set("--card", t.card);
    set("--popover", t.popover);
    set("--secondary", t.secondary);
    set("--muted", t.muted);
    set("--input", t.input);
    set("--sidebar-accent", t.sidebarAccent);
    set("--border", t.border);
    set("--sidebar-border", t.sidebarBorder);
  }

  if (isHex(b.fgColor)) {
    set("--foreground", t.foreground);
    set("--card-foreground", t.foreground);
    set("--popover-foreground", t.foreground);
    set("--secondary-foreground", t.foreground);
    set("--accent-foreground", t.foreground);
    set("--sidebar-foreground", t.foreground);
    set("--sidebar-accent-foreground", t.foreground);
    if (isHex(b.bgColor)) set("--muted-foreground", t.mutedForeground);
  }

  if (isHex(b.accentColor)) {
    set("--accent", t.accent);
    set("--gold", t.accent);
    set("--gold-light", t.accentLight);
    set("--gold-foreground", t.onAccent);
    set("--primary", t.accent);
    set("--primary-foreground", t.onAccent);
    set("--ring", t.accent);
    set("--sidebar-primary", t.accent);
    set("--sidebar-primary-foreground", t.onAccent);
    set("--sidebar-ring", t.accent);
  }
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<Branding>(DEFAULTS);

  useEffect(() => {
    let cancelled = false;
    loadBranding().then((b) => { if (!cancelled) { setBranding(b); applyThemeColors(b); } });

    // Refresh when auth changes (owner just saved branding, or new user signs in)
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "USER_UPDATED" || event === "TOKEN_REFRESHED") {
        loadBranding().then((b) => { if (!cancelled) { setBranding(b); applyThemeColors(b); } });
      }
    });

    // Custom event so the Settings screen can trigger an immediate reload after save.
    const onRefresh = () => { loadBranding().then((b) => { if (!cancelled) { setBranding(b); applyThemeColors(b); } }); };
    window.addEventListener("branding:refresh", onRefresh);

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      window.removeEventListener("branding:refresh", onRefresh);
    };
  }, []);

  return <BrandingCtx.Provider value={branding}>{children}</BrandingCtx.Provider>;
}

export function useBranding(): Branding {
  return useContext(BrandingCtx);
}

export function refreshBranding() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("branding:refresh"));
  }
}
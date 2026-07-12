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

export function applyThemeColors(b: {
  bgColor: string | null;
  fgColor: string | null;
  accentColor: string | null;
}) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const set = (name: string, val: string | null) => {
    if (val && /^#[0-9a-fA-F]{6}$/.test(val)) root.style.setProperty(name, val);
    else root.style.removeProperty(name);
  };

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

  const isHex = (v: string | null): v is string => !!v && /^#[0-9a-fA-F]{6}$/.test(v);
  const hexToRgb = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  };
  const rgbToHex = (r: number, g: number, b: number) =>
    "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  const luminance = (hex: string) => {
    const { r, g, b } = hexToRgb(hex);
    const f = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  // Shift a color toward white or black by `amt` (0..1).
  const mix = (hex: string, target: "white" | "black", amt: number) => {
    const { r, g, b } = hexToRgb(hex);
    const t = target === "white" ? 255 : 0;
    return rgbToHex(r + (t - r) * amt, g + (t - g) * amt, b + (t - b) * amt);
  };
  // Nudge a surface color slightly lighter or darker than the base background,
  // depending on whether the base is dark or light.
  const surface = (base: string, step: number) => {
    const dark = luminance(base) < 0.5;
    return mix(base, dark ? "white" : "black", step);
  };

  // ---- Background family -----------------------------------------------
  if (isHex(b.bgColor)) {
    const bg = b.bgColor;
    set("--background", bg);
    set("--sidebar", surface(bg, 0.03));
    set("--card", surface(bg, 0.05));
    set("--popover", surface(bg, 0.07));
    set("--secondary", surface(bg, 0.08));
    set("--muted", surface(bg, 0.08));
    set("--input", surface(bg, 0.09));
    set("--sidebar-accent", surface(bg, 0.07));
    set("--border", surface(bg, 0.14));
    set("--sidebar-border", surface(bg, 0.14));
  }

  // ---- Foreground family -----------------------------------------------
  if (isHex(b.fgColor)) {
    const fg = b.fgColor;
    set("--foreground", fg);
    set("--card-foreground", fg);
    set("--popover-foreground", fg);
    set("--secondary-foreground", fg);
    set("--accent-foreground", fg);
    set("--sidebar-foreground", fg);
    set("--sidebar-accent-foreground", fg);
    // muted text = foreground pulled toward the background for lower emphasis
    if (isHex(b.bgColor)) {
      set("--muted-foreground", mix(fg, luminance(b.bgColor) < 0.5 ? "black" : "white", 0.35));
    }
  }

  // ---- Accent family (primary highlight used across the UI) ------------
  if (isHex(b.accentColor)) {
    const ac = b.accentColor;
    const onAccent = luminance(ac) > 0.5 ? "#0A0A0A" : "#FFFFFF";
    set("--accent", ac);
    set("--gold", ac);
    set("--gold-light", mix(ac, "white", 0.18));
    set("--gold-foreground", onAccent);
    set("--primary", ac);
    set("--primary-foreground", onAccent);
    set("--ring", ac);
    set("--sidebar-primary", ac);
    set("--sidebar-primary-foreground", onAccent);
    set("--sidebar-ring", ac);
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
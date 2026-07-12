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

function applyThemeColors(b: Branding) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const set = (name: string, val: string | null) => {
    if (val && /^#[0-9a-fA-F]{6}$/.test(val)) root.style.setProperty(name, val);
    else root.style.removeProperty(name);
  };
  set("--background", b.bgColor);
  set("--foreground", b.fgColor);
  // Accent maps to the app's gold/primary highlight used across buttons,
  // switcher pills, sidebar accents, and links.
  set("--gold", b.accentColor);
  set("--gold-light", b.accentColor);
  set("--primary", b.accentColor);
  set("--ring", b.accentColor);
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
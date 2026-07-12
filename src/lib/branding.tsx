import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Branding = {
  orgName: string;
  shortName: string;
  tagline: string;
  supportEmail: string | null;
  loaded: boolean;
};

const DEFAULTS: Branding = {
  orgName: "Your Organization",
  shortName: "Ops",
  tagline: "Internal operating system for your team.",
  supportEmail: null,
  loaded: false,
};

const BrandingCtx = createContext<Branding>(DEFAULTS);

async function loadBranding(): Promise<Branding> {
  try {
    const { data } = await supabase
      .from("stores")
      .select("name, short_name, tagline, support_email")
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (!data) return { ...DEFAULTS, loaded: true };
    return {
      orgName: data.name || DEFAULTS.orgName,
      shortName: (data as any).short_name?.trim() || data.name || DEFAULTS.shortName,
      tagline: (data as any).tagline?.trim() || DEFAULTS.tagline,
      supportEmail: (data as any).support_email || null,
      loaded: true,
    };
  } catch {
    return { ...DEFAULTS, loaded: true };
  }
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<Branding>(DEFAULTS);

  useEffect(() => {
    let cancelled = false;
    loadBranding().then((b) => { if (!cancelled) setBranding(b); });

    // Refresh when auth changes (owner just saved branding, or new user signs in)
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "USER_UPDATED" || event === "TOKEN_REFRESHED") {
        loadBranding().then((b) => { if (!cancelled) setBranding(b); });
      }
    });

    // Custom event so the Settings screen can trigger an immediate reload after save.
    const onRefresh = () => { loadBranding().then((b) => { if (!cancelled) setBranding(b); }); };
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

// Keep the browser tab title in sync with the current org short name.
// Preserves the per-route title suffix set by TanStack head().
let originalSuffix: string | null = null;
export function useDocumentTitleSync() {
  const branding = useBranding();
  useEffect(() => {
    if (typeof document === "undefined") return;
    const current = document.title;
    // Try to detect a per-route prefix ("Cash · Dip N Shake OS" etc.)
    const parts = current.split(" · ");
    const routePart = parts[0] || branding.shortName;
    if (originalSuffix === null) originalSuffix = parts.slice(1).join(" · ") || branding.shortName;
    document.title = `${routePart} · ${branding.shortName}`;
  }, [branding.shortName]);
}

export function refreshBranding() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("branding:refresh"));
  }
}
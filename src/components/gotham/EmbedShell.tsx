import { createContext, useContext, type ReactNode } from "react";
import { AppShell } from "@/components/gotham/AppShell";

const EmbedContext = createContext(false);

export function EmbeddedProvider({ children }: { children: ReactNode }) {
  return <EmbedContext.Provider value={true}>{children}</EmbedContext.Provider>;
}

export function useEmbedded() {
  return useContext(EmbedContext);
}

/**
 * When rendered standalone, wraps content in AppShell.
 * When rendered inside an <EmbeddedProvider> (e.g. the /admin tabs page)
 * it renders children directly so we don't double-shell.
 */
export function EmbedShell({ children }: { children?: ReactNode }) {
  const embedded = useContext(EmbedContext);
  if (embedded) return <>{children}</>;
  return <AppShell>{children}</AppShell>;
}

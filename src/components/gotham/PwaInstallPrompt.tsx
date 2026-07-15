import { useEffect, useState } from "react";
import { Share, Plus, X } from "lucide-react";
import { useBranding } from "@/lib/branding";

// Shows an "Add to Home Screen" banner on iPad/iPhone Safari when the app
// is not already running as a standalone PWA.
export function PwaInstallPrompt() {
  const branding = useBranding();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const isIos =
      /ipad|iphone|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    const dismissed = sessionStorage.getItem("pwa-prompt-dismissed");

    if (isIos && !isStandalone && !dismissed) {
      // Small delay so the page loads before showing the banner
      const t = setTimeout(() => setVisible(true), 3000);
      return () => clearTimeout(t);
    }
  }, []);

  function dismiss() {
    sessionStorage.setItem("pwa-prompt-dismissed", "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 m-3 mb-safe rounded-2xl border border-amber-500/30 bg-zinc-900/95 p-4 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-4 duration-300"
      role="dialog"
      aria-label={`Install ${branding.orgName}`}
    >
      <button
        onClick={dismiss}
        className="absolute right-3 top-3 rounded-full p-1 text-zinc-400 hover:text-zinc-200"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3">
        {/* App icon */}
        <img
          src="/icons/apple-touch-icon.png"
          alt={branding.orgName}
          className="h-14 w-14 rounded-2xl flex-shrink-0 shadow-md"
        />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-400">Install {branding.orgName}</p>
          <p className="mt-0.5 text-xs text-zinc-400 leading-relaxed">
            Add to your Home Screen for fast access — works offline and looks great on iPad.
          </p>

          {/* Step-by-step instructions */}
          <div className="mt-2 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-xs text-zinc-300">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 font-bold text-[10px] flex-shrink-0">
                1
              </span>
              <span>Tap</span>
              <span className="inline-flex items-center gap-0.5 rounded bg-zinc-700/80 px-1.5 py-0.5 font-medium text-zinc-200">
                <Share className="h-3 w-3" />
                <span>Share</span>
              </span>
              <span>in the toolbar</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-zinc-300">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 font-bold text-[10px] flex-shrink-0">
                2
              </span>
              <span>Tap</span>
              <span className="inline-flex items-center gap-0.5 rounded bg-zinc-700/80 px-1.5 py-0.5 font-medium text-zinc-200">
                <Plus className="h-3 w-3" />
                <span>Add to Home Screen</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

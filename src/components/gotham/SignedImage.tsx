import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Renders an image stored in the private `gotham-photos` bucket.
 * Accepts either a storage path (e.g. "inventory/abc/123.jpg") or an
 * already-public URL (passes through). Signs URLs on demand and caches
 * them in-memory for the session.
 */
const cache = new Map<string, { url: string; expiresAt: number }>();

export function SignedImage({
  path,
  alt,
  className,
  bucket = "gotham-photos",
}: {
  path: string | null | undefined;
  alt: string;
  className?: string;
  bucket?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!path) { setUrl(null); return; }
    if (/^https?:\/\//i.test(path)) { setUrl(path); return; }

    const cacheKey = `${bucket}:${path}`;
    const hit = cache.get(cacheKey);
    if (hit && hit.expiresAt > Date.now() + 60_000) {
      setUrl(hit.url);
      return;
    }
    (async () => {
      const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
      if (cancelled || !data?.signedUrl) return;
      cache.set(cacheKey, { url: data.signedUrl, expiresAt: Date.now() + 55 * 60 * 1000 });
      setUrl(data.signedUrl);
    })();
    return () => { cancelled = true; };
  }, [path, bucket]);

  if (!url) return null;
  return <img src={url} alt={alt} className={className} />;
}

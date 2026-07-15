// Dip N Shake Dash — Service Worker
// Handles: push notifications, offline caching, background sync

const CACHE_VERSION = "v2";
const STATIC_CACHE = `gotham-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `gotham-dynamic-${CACHE_VERSION}`;

// Assets to pre-cache on install (shell + icons)
const PRECACHE_URLS = [
  "/",
  "/manifest.webmanifest",
  "/favicon.ico",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/apple-touch-icon.png",
];

const OFFLINE_FALLBACK = "/";

// ─── Install: pre-cache shell assets ─────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)));
  self.skipWaiting();
});

// ─── Activate: clean up old caches ───────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== STATIC_CACHE && k !== DYNAMIC_CACHE)
            .map((k) => caches.delete(k)),
        ),
      ),
  );
  event.waitUntil(clients.claim());
});

// ─── Fetch: tiered caching strategy ──────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and Supabase API calls (always live)
  if (request.method !== "GET") return;
  if (url.hostname.includes("supabase.co")) return;
  if (url.pathname.startsWith("/__l5e/")) return;

  // Static assets → cache-first
  if (
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/assets/") ||
    url.pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|woff2?|ttf|css)$/)
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // API routes → network-only
  if (url.pathname.startsWith("/api/")) return;

  // Page navigations → network-first with offline fallback
  if (request.mode === "navigate") {
    event.respondWith(networkFirstWithFallback(request));
    return;
  }

  // Everything else → stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("", { status: 503 });
  }
}

async function networkFirstWithFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return (await caches.match(OFFLINE_FALLBACK)) ?? new Response("Offline", { status: 503 });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return cached ?? (await fetchPromise) ?? new Response("", { status: 503 });
}

// ─── Push notifications ───────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  const data = event.data?.json?.() ?? {};
  const title = data.title ?? "Dip N Shake OS";
  const body = data.body ?? "You have a new alert.";
  const icon = data.icon ?? "/icons/icon-192x192.png";
  const badge = data.badge ?? "/icons/icon-96x96.png";
  const url = data.url ?? "/alerts";
  const tag = data.tag ?? "gotham-alert";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag,
      data: { url },
      requireInteraction: data.priority === "critical",
      actions: data.priority === "critical" ? [{ action: "view", title: "View Alert" }] : [],
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/alerts";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    }),
  );
});

// ─── Background sync (retry clock-in/out when offline) ───────────────────────
self.addEventListener("sync", (event) => {
  if (event.tag === "gotham-punch-sync") {
    event.waitUntil(replayPendingPunches());
  }
});

async function replayPendingPunches() {
  const allClients = await clients.matchAll({ type: "window" });
  for (const client of allClients) {
    client.postMessage({ type: "SYNC_PUNCHES" });
  }
}

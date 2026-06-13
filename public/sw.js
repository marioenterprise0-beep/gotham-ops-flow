// Gotham OS Service Worker — handles push events for mobile notifications.
// Registered by src/hooks/use-push-notifications.ts

self.addEventListener("push", (event) => {
  const data = event.data?.json?.() ?? {};
  const title = data.title ?? "Gotham OS";
  const body = data.body ?? "You have a new alert.";
  const icon = data.icon ?? "/favicon.ico";
  const badge = data.badge ?? "/favicon.ico";
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
    })
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
    })
  );
});

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(clients.claim()));

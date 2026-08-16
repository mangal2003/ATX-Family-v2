self.addEventListener("push", (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || "New alert from ATX Family!",
    icon: "/images/atx-logo.png",
    badge: "/images/atx-logo.png",
    vibrate: [100, 50, 100],
    data: {
      url: data.url || "/quiz",
    },
  };

  event.waitUntil(
    self.registration.showNotification(
      data.title || "ATX Family Alert",
      options,
    ),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/quiz";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (let client of windowClients) {
          if (client.url.includes(targetUrl) && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      }),
  );
});

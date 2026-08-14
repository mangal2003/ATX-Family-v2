// public/sw.js - ATX Platform Service Worker

self.addEventListener("push", (event) => {
  let data = {
    title: "ATX Quiz",
    body: "A new quiz window is now active!",
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: "/images/atx-logo.png", // Ensure this points to your site icon/logo
    badge: "/images/atx-logo.png", // Monochromatic icon for mobile status bars
    vibrate: [100, 50, 100],
    data: {
      url: data.url || "/quiz",
    },
    actions: [
      { action: "open", title: "Play Now" },
      { action: "close", title: "Dismiss" },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Handle notification click
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "close") return;

  const targetUrl = event.notification.data.url || "/quiz";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // Focus open window if exists, else open new tab
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

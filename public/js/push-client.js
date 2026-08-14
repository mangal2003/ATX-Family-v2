// public/js/push-client.js

// Replace with your generated VAPID Public Key
const PUBLIC_VAPID_KEY =
  "BLYuqpTZyP4-rcnEkqZnsno_91OEkvMGeoSdLohI1na_3Va552VJIAP9AHUNuZ2jV1cM-QivXMt6nUQzr_cNSvQ";

/**
 * Utility: Convert URL Safe Base64 string to Uint8Array required by PushManager
 */
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Register Service Worker and subscribe user to Web Push
 */
async function subscribeUserToPush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("Web Push is not supported on this browser.");
    return;
  }

  try {
    // 1. Register Service Worker
    const register = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });

    // 2. Request Notification Permission
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.log("Notification permission denied by user.");
      return;
    }

    // 3. Subscribe User via PushManager
    const subscription = await register.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY),
    });

    // 4. Send Subscription JSON to Express Backend
    await fetch("/quiz/subscribe-push", {
      method: "POST",
      body: JSON.stringify(subscription),
      headers: {
        "Content-Type": "application/json",
      },
    });

    console.log("Successfully subscribed to ATX Web Push notifications.");
  } catch (error) {
    console.error("Error during Web Push subscription:", error);
  }
}

// Automatically prompt on page load if user is logged in and hasn't explicitly denied
document.addEventListener("DOMContentLoaded", () => {
  if (Notification.permission === "default") {
    subscribeUserToPush();
  }
});

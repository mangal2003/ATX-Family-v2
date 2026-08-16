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

async function registerPushSubscription() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("[PUSH] Web Push is not supported in this browser.");
    return;
  }

  try {
    // 1. Register the Service Worker
    console.log("[PUSH] Registering service worker...");
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
    await navigator.serviceWorker.ready;
    console.log("[PUSH] Service Worker Ready.");

    // 2. Fetch Public VAPID Key from the server
    const keyRes = await fetch("/api/push/public-key");
    const { publicKey } = await keyRes.json();

    if (!publicKey) {
      console.error("[PUSH] No VAPID public key returned from server.");
      return;
    }

    // 3. Request Notification Permission
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("[PUSH] Notification permission denied by user.");
      return;
    }

    // 4. Subscribe to Push Manager
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      console.log("[PUSH] Creating new push subscription...");
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    // 5. Send Subscription to backend
    console.log("[PUSH] Dispatching subscription to server endpoint...");
    const saveRes = await fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription),
    });

    const result = await saveRes.json();
    if (saveRes.ok && result.success) {
      console.log("[PUSH] ✅ Successfully registered and saved in MongoDB!");
    } else {
      console.error("[PUSH] Server rejected subscription:", result);
    }
  } catch (err) {
    console.error("[PUSH] Registration failed:", err);
  }
}

// Auto-run when page loads
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", registerPushSubscription);
} else {
  registerPushSubscription();
}

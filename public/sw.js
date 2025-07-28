// Service Worker for Push Notifications
const CACHE_NAME = "dicey-movements-v4";

// Install event - cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(["/", "/favicon.svg", "/manifest.json"]);
    })
  );
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName))
        );
      }),
      self.clients.claim(),
    ])
  );
});

// Push notification event
self.addEventListener("push", (event) => {
  try {
    let notificationData = {
      title: "⏰ Timer Expired!",
      body: "Your workout timer has finished! Time to get moving!",
      icon: "/favicon.svg",
    };

    // If we have data from the push event, use it
    if (event.data) {
      try {
        const data = event.data.json();
        notificationData = { ...notificationData, ...data };
      } catch (e) {
        console.error("Service Worker: Error parsing push data:", e);
      }
    }

    try {
      const promise = self.registration.showNotification(notificationData.title, notificationData);

      // Only use waitUntil if it's a real push event
      if (event.waitUntil && typeof event.waitUntil === "function") {
        event.waitUntil(promise);
      }
    } catch (error) {
      console.error("Service Worker: Error showing notification:", error);
    }
  } catch (error) {
    console.error("Service Worker: Error in push event handler:", error);
  }
});

// Notification click event
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // Focus app and send timer completion message
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          // Focus existing window and send message
          client.focus();
          client.postMessage({ type: "TIMER_COMPLETE_FROM_NOTIFICATION" });
          return Promise.resolve();
        }
      }
      if (clients.openWindow) {
        // Open new window with timer completion parameter
        return clients.openWindow("/?timerComplete=true");
      }
    })
  );
});

// Background sync for offline functionality
self.addEventListener("sync", (event) => {
  if (event.tag === "background-sync") {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  // Handle background sync tasks
}

// Message listener to handle updates
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Fetch event for offline support
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

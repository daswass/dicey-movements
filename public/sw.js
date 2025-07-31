// Service Worker for Push Notifications
// This service worker follows standard practices

const CACHE_NAME = "dicey-movements-v16";

// Install event - cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(["/", "/favicon.svg", "/manifest.json"]);
    })
  );
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_NAME)
            .map((cacheName) => {
              console.log("Service Worker: Deleting old cache:", cacheName);
              return caches.delete(cacheName);
            })
        );
      }),
      self.clients.claim(),
    ])
  );
});

// Push notification event
self.addEventListener("push", async (event) => {
  console.log("Service Worker: Push event received");
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

    // Handle clear notifications type
    if (notificationData.data && notificationData.data.type === "clear_notifications") {
      // Clear existing notifications by tag
      const clearTag = notificationData.data.clearTag || notificationData.tag;
      if (clearTag) {
        self.registration.getNotifications().then((notifications) => {
          notifications.forEach((notification) => {
            if (notification.tag === clearTag) {
              notification.close();
            }
          });
        });
      }

      // Send message to all clients to reset notification state
      clients.matchAll().then((clientList) => {
        clientList.forEach((client) => {
          client.postMessage({
            type: "RESET_NOTIFICATION_STATE",
            tag: clearTag,
          });
        });
      });

      return;
    }

    // Handle silent high five notifications
    if (notificationData.data && notificationData.data.type === "high_five") {
      // Send message to all clients to trigger high five effects
      clients.matchAll({ type: "window" }).then((clientList) => {
        if (clientList.length === 0) {
          return clients.matchAll().then((allClients) => {
            allClients.forEach((client) => {
              client.postMessage({
                type: "HIGH_FIVE_FROM_NOTIFICATION",
                notificationData: notificationData.data,
              });
            });
          });
        }
        clientList.forEach((client) => {
          client.postMessage({
            type: "HIGH_FIVE_FROM_NOTIFICATION",
            notificationData: notificationData.data,
          });
        });
      });

      return;
    }

    if (notificationData.silent === true) {
      return;
    }

    try {
      // Extract notification options properly
      const notificationOptions = {
        body: notificationData.body,
        icon: notificationData.icon,
        badge: notificationData.badge,
        tag: notificationData.tag,
        group: notificationData.group,
        requireInteraction: notificationData.requireInteraction,
        actions: notificationData.actions,
        data: notificationData.data,
        silent: notificationData.silent,
      };

      const promise = self.registration.showNotification(
        notificationData.title,
        notificationOptions
      );

      promise.catch((error) => {
        console.error("Service Worker: Error showing notification:", error);
      });

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

  // Handle notification actions
  if (event.action) {
    console.log("Service Worker: Notification action clicked:", event.action);
  }

  // Check if this is a timer notification
  const isTimerNotification =
    event.notification.tag === "timer-notification" ||
    event.notification.data?.type === "timer_expired" ||
    event.notification.title.includes("Timer");

  // Check if this is a high five notification
  const isHighFiveNotification =
    event.notification.tag === "high_five" ||
    event.notification.data?.type === "high_five" ||
    event.notification.title.includes("High Five");

  // Focus app and send appropriate message
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          // Focus existing window and send message
          client.focus();

          if (isTimerNotification) {
            client.postMessage({ type: "TIMER_COMPLETE_FROM_NOTIFICATION" });
          } else if (isHighFiveNotification) {
            client.postMessage({
              type: "HIGH_FIVE_FROM_NOTIFICATION",
              notificationData: event.notification.data,
            });
          } else {
            // For non-timer notifications (friend activity, etc.), just focus without special handling
            client.postMessage({ type: "NOTIFICATION_CLICKED" });
          }
          return Promise.resolve();
        }
      }
      if (clients.openWindow) {
        // Open new window with appropriate parameter
        if (isTimerNotification) {
          return clients.openWindow("/?timerComplete=true");
        } else {
          return clients.openWindow("/");
        }
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

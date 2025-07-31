// Service Worker for Push Notifications
// This service worker follows standard practices

const CACHE_NAME = "dicey-movements-v11";

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
    } else {
      console.log("Service Worker: No push data received, using defaults");
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

      console.log("Service Worker: Final notification options:", notificationOptions);
      console.log("Service Worker: Showing notification with tag:", notificationOptions.tag);
      const promise = self.registration.showNotification(
        notificationData.title,
        notificationOptions
      );

      // Log when notification is actually shown
      promise
        .then(() => {
          console.log(
            "Service Worker: Notification shown successfully with tag:",
            notificationOptions.tag
          );
        })
        .catch((error) => {
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
  console.log("Service Worker: Notification clicked:", event.notification.title);
  event.notification.close();

  // Check if this is a timer notification
  const isTimerNotification =
    event.notification.tag === "timer-notification" ||
    event.notification.data?.type === "timer_expired" ||
    event.notification.title.includes("Timer");

  // Focus app and send appropriate message
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          // Focus existing window and send message
          console.log("Service Worker: Focusing existing window");
          client.focus();

          if (isTimerNotification) {
            client.postMessage({ type: "TIMER_COMPLETE_FROM_NOTIFICATION" });
          } else {
            // For non-timer notifications (friend activity, etc.), just focus without special handling
            client.postMessage({ type: "NOTIFICATION_CLICKED" });
          }
          return Promise.resolve();
        }
      }
      if (clients.openWindow) {
        // Open new window with appropriate parameter
        console.log("Service Worker: Opening new window");
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
  console.log("Service Worker: Background sync event:", event.tag);
  if (event.tag === "background-sync") {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  // Handle background sync tasks
  console.log("Service Worker: Performing background sync");
}

// Message listener to handle updates
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

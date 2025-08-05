// Service Worker for Push Notifications
// This service worker follows standard practices

// Use a stable cache name that doesn't change unless the service worker actually changes
const CACHE_NAME = "dicey-movements-v1";
const STATIC_CACHE_NAME = "dicey-movements-static-v1";

// Files to cache for offline functionality
const STATIC_FILES = ["/", "/favicon.svg", "/manifest.json", "/index.html"];

// Install event - cache static assets
self.addEventListener("install", (event) => {
  console.log("Service Worker: Installing new version");

  event.waitUntil(
    Promise.all([
      // Cache static files
      caches.open(STATIC_CACHE_NAME).then((cache) => {
        console.log("Service Worker: Caching static files");
        return cache.addAll(STATIC_FILES);
      }),
      // Skip waiting to activate immediately
      self.skipWaiting(),
    ])
  );
});

// Activate event - clean up old caches and claim clients
self.addEventListener("activate", (event) => {
  console.log("Service Worker: Activating new version");

  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter(
              (cacheName) =>
                cacheName !== CACHE_NAME &&
                cacheName !== STATIC_CACHE_NAME &&
                cacheName.startsWith("dicey-movements")
            )
            .map((cacheName) => {
              console.log("Service Worker: Deleting old cache:", cacheName);
              return caches.delete(cacheName);
            })
        );
      }),
      // Claim all clients immediately
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

    // Handle silent high five notifications (even if silent)
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

    // Handle other silent notifications (but not high fives)
    if (
      notificationData.silent === true &&
      (!notificationData.data || notificationData.data.type !== "high_five")
    ) {
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

    // Handle high five action from friend activity notification
    if (event.action === "high_five") {
      const notificationData = event.notification.data;
      if (notificationData?.friendName) {
        // Send message to trigger high five effect and send high five back
        event.waitUntil(
          clients.matchAll({ type: "window" }).then((clientList) => {
            if (clientList.length === 0) {
              return clients.matchAll().then((allClients) => {
                allClients.forEach((client) => {
                  client.postMessage({
                    type: "HIGH_FIVE_FROM_NOTIFICATION",
                    notificationData: {
                      type: "high_five",
                      friendName: notificationData.friendName,
                      fromNotificationAction: true,
                      friendId: notificationData.friendId, // Include friend ID for sending high five back
                      activity: notificationData.activity, // Include activity information
                    },
                  });
                });
              });
            }
            clientList.forEach((client) => {
              client.postMessage({
                type: "HIGH_FIVE_FROM_NOTIFICATION",
                notificationData: {
                  type: "high_five",
                  friendName: notificationData.friendName,
                  fromNotificationAction: true,
                  friendId: notificationData.friendId, // Include friend ID for sending high five back
                  activity: notificationData.activity, // Include activity information
                },
              });
            });
          })
        );
        return;
      }
    }
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
  console.log("Service Worker: Background sync triggered");
}

// Message listener to handle updates and other messages
self.addEventListener("message", (event) => {
  console.log("Service Worker: Message received:", event.data);

  if (event.data && event.data.type === "SKIP_WAITING") {
    console.log("Service Worker: Skipping waiting to activate new version");
    self.skipWaiting();
  }

  if (event.data && event.data.type === "GET_VERSION") {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

// Fetch event for offline functionality
self.addEventListener("fetch", (event) => {
  // Only handle GET requests
  if (event.request.method !== "GET") {
    return;
  }

  // Skip non-HTTP requests
  if (!event.request.url.startsWith("http")) {
    return;
  }

  // Skip external requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached version if available
      if (response) {
        return response;
      }

      // Otherwise, fetch from network
      return fetch(event.request).then((response) => {
        // Don't cache non-successful responses
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }

        // Clone the response
        const responseToCache = response.clone();

        // Cache the response for future use
        caches.open(STATIC_CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      });
    })
  );
});

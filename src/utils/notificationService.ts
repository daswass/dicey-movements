import { supabase } from "./supabaseClient";
import { api } from "./api";

// Notification Service for Desktop and Safari Push Notifications
export interface NotificationPermission {
  permission: "granted" | "denied" | "default";
  supported: boolean;
}

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

class NotificationService {
  private registration: ServiceWorkerRegistration | null = null;
  private isSupported: boolean = false;

  constructor() {
    this.checkSupport();
  }

  private checkSupport(): void {
    this.isSupported = "serviceWorker" in navigator && "PushManager" in window;
    console.log("NotificationService: Push notifications supported:", this.isSupported);
  }

  async initialize(): Promise<boolean> {
    if (!this.isSupported) {
      console.warn("NotificationService: Push notifications not supported");
      return false;
    }

    try {
      // Register service worker
      this.registration = await navigator.serviceWorker.register("/sw.js");
      console.log("NotificationService: Service worker registered:", this.registration);

      // Listen for service worker updates
      this.registration.addEventListener("updatefound", () => {
        const newWorker = this.registration!.installing;
        if (newWorker) {
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              console.log("NotificationService: New service worker available");
            }
          });
        }
      });

      return true;
    } catch (error) {
      console.error("NotificationService: Failed to register service worker:", error);
      return false;
    }
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported) {
      return { permission: "denied", supported: false };
    }

    try {
      const permission = await Notification.requestPermission();
      console.log("NotificationService: Permission result:", permission);
      return { permission, supported: true };
    } catch (error) {
      console.error("NotificationService: Error requesting permission:", error);
      return { permission: "denied", supported: true };
    }
  }

  async getPermissionStatus(): Promise<NotificationPermission> {
    if (!this.isSupported) {
      return { permission: "denied", supported: false };
    }

    return { permission: Notification.permission, supported: true };
  }

  async subscribeToPushNotifications(): Promise<PushSubscription | null> {
    if (!this.registration || !this.isSupported) {
      console.warn("NotificationService: Cannot subscribe - no registration or not supported");
      return null;
    }

    try {
      // Check if already subscribed
      const existingSubscription = await this.registration.pushManager.getSubscription();
      if (existingSubscription) {
        console.log("NotificationService: Already subscribed to push notifications");
        return this.convertSubscription(existingSubscription);
      }

      // Request permission if not granted
      const permission = await this.requestPermission();
      if (permission.permission !== "granted") {
        console.warn("NotificationService: Permission not granted for push notifications");
        return null;
      }

      // Subscribe to push notifications
      const vapidPublicKey = await this.getVapidPublicKey();
      const applicationServerKey = this.urlBase64ToUint8Array(vapidPublicKey);

      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey,
      });

      console.log("NotificationService: Successfully subscribed to push notifications");

      // Save subscription to backend
      const convertedSubscription = this.convertSubscription(subscription);
      await this.saveSubscriptionToBackend(convertedSubscription);

      return convertedSubscription;
    } catch (error) {
      console.error("NotificationService: Error subscribing to push notifications:", error);
      return null;
    }
  }

  async unsubscribeFromPushNotifications(): Promise<boolean> {
    if (!this.registration) {
      return false;
    }

    try {
      const subscription = await this.registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        console.log("NotificationService: Successfully unsubscribed from push notifications");

        // Remove subscription from backend
        await this.removeSubscriptionFromBackend(subscription.endpoint);

        return true;
      }
      return false;
    } catch (error) {
      console.error("NotificationService: Error unsubscribing from push notifications:", error);
      return false;
    }
  }

  async sendLocalNotification(
    title: string,
    body: string,
    options: NotificationOptions = {}
  ): Promise<void> {
    if (!this.isSupported) {
      console.warn("NotificationService: Cannot send notification - not supported");
      return;
    }

    const permission = await this.getPermissionStatus();
    if (permission.permission !== "granted") {
      console.warn("NotificationService: Permission not granted for notifications");
      return;
    }

    const defaultOptions: NotificationOptions = {
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      requireInteraction: true,
      silent: false,
      tag: "timer-notification",
      data: {
        url: window.location.href,
        timestamp: Date.now(),
      },
    };

    const notification = new Notification(title, { ...defaultOptions, ...options });

    // Handle notification click
    notification.onclick = (event) => {
      event.preventDefault();
      window.focus();
      notification.close();
    };
  }

  async sendTimerExpiredNotification(): Promise<void> {
    await this.sendLocalNotification(
      "⏰ Timer Expired!",
      "Your workout timer has finished! Time to get moving!",
      {
        tag: "timer-expired",
        requireInteraction: true,
        silent: false,
      }
    );
  }

  // Safari-specific push notification support
  async requestSafariPermission(): Promise<boolean> {
    if (!this.isSafari()) {
      return false;
    }

    try {
      // Safari uses a different API for push notifications
      if ("safari" in window && "pushNotification" in (window as any).safari) {
        const permission = await (window as any).safari.pushNotification.requestPermission(
          "https://your-domain.com", // Your website URL
          "https://your-domain.com/push", // Your push endpoint
          {
            website_id: "your-website-id", // You'll need to register this with Apple
            website_push_id: "your-push-id",
          }
        );
        return permission.permission === "granted";
      }
      return false;
    } catch (error) {
      console.error("NotificationService: Error requesting Safari permission:", error);
      return false;
    }
  }

  private isSafari(): boolean {
    return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  }

  private convertSubscription(subscription: globalThis.PushSubscription): PushSubscription {
    return {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: btoa(
          String.fromCharCode.apply(
            null,
            Array.from(new Uint8Array(subscription.getKey("p256dh")!))
          )
        ),
        auth: btoa(
          String.fromCharCode.apply(null, Array.from(new Uint8Array(subscription.getKey("auth")!)))
        ),
      },
    };
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  private async getVapidPublicKey(): Promise<string> {
    try {
      const data = await api.getVapidPublicKey();
      return data.publicKey;
    } catch (error) {
      console.error("NotificationService: Error fetching VAPID public key:", error);
      throw new Error("Failed to fetch VAPID public key from backend");
    }
  }

  // Utility method to check if the app is in the foreground
  isAppInForeground(): boolean {
    return !document.hidden;
  }

  // Utility method to check if the app is focused
  isAppFocused(): boolean {
    return document.hasFocus();
  }

  private async saveSubscriptionToBackend(subscription: PushSubscription): Promise<void> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        console.warn("NotificationService: No authenticated user found");
        return;
      }

      await api.subscribeToPush(user.id, subscription);
      console.log("NotificationService: Subscription saved to backend");
    } catch (error) {
      console.error("NotificationService: Error saving subscription to backend:", error);
    }
  }

  private async removeSubscriptionFromBackend(endpoint: string): Promise<void> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        console.warn("NotificationService: No authenticated user found");
        return;
      }

      await api.unsubscribeFromPush(user.id, endpoint);
      console.log("NotificationService: Subscription removed from backend");
    } catch (error) {
      console.error("NotificationService: Error removing subscription from backend:", error);
    }
  }
}

// Create a singleton instance
export const notificationService = new NotificationService();

// Export the class for testing
export { NotificationService };

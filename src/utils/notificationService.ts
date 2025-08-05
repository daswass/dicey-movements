import { api } from "./api";
import { supabase } from "./supabaseClient";

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
  deviceId?: string;
  deviceType?: string;
  browser?: string;
  platform?: string;
}

class NotificationService {
  private registration: ServiceWorkerRegistration | null = null;
  private isSupported: boolean = false;
  private deviceId: string | null = null;

  constructor() {
    this.checkSupport();
    this.generateDeviceId();
  }

  private checkSupport(): void {
    this.isSupported = "serviceWorker" in navigator && "PushManager" in window;
  }

  // Generate a unique device ID based on browser fingerprint
  private generateDeviceId(): void {
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      ctx?.fillText("Device fingerprint", 10, 10);
      const fingerprint = canvas.toDataURL();

      // Create a hash from browser characteristics
      const characteristics = [
        navigator.userAgent,
        navigator.language,
        screen.width + "x" + screen.height,
        new Date().getTimezoneOffset(),
        fingerprint,
      ].join("|");

      // Simple hash function
      let hash = 0;
      for (let i = 0; i < characteristics.length; i++) {
        const char = characteristics.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32-bit integer
      }

      this.deviceId = Math.abs(hash).toString(36);
    } catch (error) {
      console.error("NotificationService: Error generating device ID:", error);
      this.deviceId = "unknown";
    }
  }

  // Detect device type and browser
  private getDeviceInfo(): { deviceType: string; browser: string; platform: string } {
    const userAgent = navigator.userAgent;
    let deviceType = "desktop";
    let browser = "unknown";
    let platform = "unknown";

    // Detect device type
    if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)) {
      deviceType = "mobile";
    } else if (/iPad|Android.*Tablet/i.test(userAgent)) {
      deviceType = "tablet";
    }

    // Detect browser
    if (userAgent.includes("Chrome")) browser = "chrome";
    else if (userAgent.includes("Firefox")) browser = "firefox";
    else if (userAgent.includes("Safari")) browser = "safari";
    else if (userAgent.includes("Edge")) browser = "edge";

    // Detect platform
    if (userAgent.includes("Windows")) platform = "windows";
    else if (userAgent.includes("Mac")) platform = "macos";
    else if (userAgent.includes("Linux")) platform = "linux";
    else if (userAgent.includes("Android")) platform = "android";
    else if (userAgent.includes("iOS")) platform = "ios";

    return { deviceType, browser, platform };
  }

  async initialize(): Promise<boolean> {
    if (!this.isSupported) {
      console.warn("NotificationService: Push notifications not supported");
      return false;
    }

    try {
      // Get existing service worker registration instead of creating a new one
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        console.warn("NotificationService: No service worker registration found");
        return false;
      }
      this.registration = registration;

      // Check if this is a fresh app launch
      await this.checkForFreshLaunch();

      return true;
    } catch (error) {
      console.error("NotificationService: Failed to initialize:", error);
      return false;
    }
  }

  // Check if this is a fresh launch and force subscription refresh if needed
  private async checkForFreshLaunch(): Promise<void> {
    try {
      // Check if we have a stored device ID
      const storedDeviceId = localStorage.getItem("notification_device_id");

      if (!storedDeviceId || storedDeviceId !== this.deviceId) {
        // Store the new device ID
        localStorage.setItem("notification_device_id", this.deviceId || "");

        // Force subscription refresh
        await this.forceRefreshSubscription();
      }
    } catch (error) {
      console.error("NotificationService: Error checking for fresh launch:", error);
    }
  }

  // Handle service worker changes (like home screen re-add)
  private async handleServiceWorkerChange(): Promise<void> {
    console.log("NotificationService: Handling service worker change...");

    try {
      const registration = await navigator.serviceWorker.getRegistration();

      if (registration) {
        this.registration = registration;
        await this.forceRefreshSubscription();
      }
    } catch (error) {
      console.error("NotificationService: Error handling service worker change:", error);
    }
  }

  private async forceRefreshSubscription(): Promise<void> {
    console.log("NotificationService: Force refreshing subscription...");
    try {
      console.log("NotificationService: Unsubscribing from existing subscription...");
      await this.unsubscribeFromPushNotifications();

      // Wait a moment for cleanup
      await new Promise((resolve) => setTimeout(resolve, 1000));

      console.log("NotificationService: Creating new subscription...");
      const newSubscription = await this.subscribeToPushNotifications(true);

      if (newSubscription) {
        console.log(
          "NotificationService: New subscription created successfully:",
          newSubscription.deviceId
        );
      } else {
        console.log("NotificationService: Failed to create new subscription");
      }
    } catch (error) {
      console.error("NotificationService: Error force refreshing subscription:", error);
    }
  }

  // Reset all notification state (called when clear notification is received)
  resetNotificationState(): void {
    // Clear localStorage
    localStorage.removeItem("notification_endpoint");
    localStorage.removeItem("notification_device_id");

    // Clear sessionStorage
    sessionStorage.removeItem("openedFromNotification");
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported) {
      return { permission: "denied", supported: false };
    }

    try {
      const permission = await Notification.requestPermission();

      if (permission === "granted") {
        const storedEndpoint = localStorage.getItem("notification_endpoint");
        const currentSubscription = await this.registration?.pushManager.getSubscription();

        if (!storedEndpoint || !currentSubscription) {
          await this.forceRefreshSubscription();
        }
      }

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

  async subscribeToPushNotifications(force: boolean = false): Promise<PushSubscription | null> {
    if (!this.registration || !this.isSupported) {
      console.warn("NotificationService: Cannot subscribe - no registration or not supported");
      return null;
    }

    try {
      // Check if already subscribed (unless forcing)
      if (!force) {
        const existingSubscription = await this.registration.pushManager.getSubscription();
        if (existingSubscription) {
          return this.convertSubscription(existingSubscription);
        }
      }

      // Request permission if not granted (unless forcing)
      if (!force) {
        const permission = await this.requestPermission();
        if (permission.permission !== "granted") {
          console.warn("NotificationService: Permission not granted for push notifications");
          return null;
        }
      }

      // Subscribe to push notifications
      const vapidPublicKey = await this.getVapidPublicKey();
      const applicationServerKey = this.urlBase64ToUint8Array(vapidPublicKey);

      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey,
      });

      // Save subscription to backend
      const convertedSubscription = this.convertSubscription(subscription);
      await this.saveSubscriptionToBackend(convertedSubscription);

      // Store endpoint for tracking
      localStorage.setItem("notification_endpoint", subscription.endpoint);

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
        group: "dicey-movements", // Group all notifications together
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
    console.log(
      "NotificationService: sendTimerExpiredNotification called, document.hidden:",
      document.hidden
    );

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        console.log(
          "NotificationService: User found, sending push notification for user:",
          user.id
        );
        await api.fetch("/api/push/send", {
          method: "POST",
          body: JSON.stringify({
            userId: user.id,
            payload: {
              type: "timer_expired",
              title: "⏰ Timer Expired!",
              body: "Your workout timer has finished! Time to get movin'!",
              icon: "/favicon.svg",
              badge: "/favicon.svg",
              tag: "timer-notification",
              group: "dicey-movements",
              requireInteraction: true,
              actions: [
                {
                  action: "start-workout",
                  title: "Start Workout",
                  icon: "/favicon.svg",
                },
                {
                  action: "dismiss",
                  title: "Dismiss",
                },
              ],
              data: {
                url: "/",
                timestamp: Date.now(),
                type: "timer_expired",
              },
            },
          }),
        });
      } else {
        console.log("NotificationService: No user found");
      }
    } catch (error) {
      // Handle errors gracefully - don't throw, just log
      console.warn(
        "NotificationService: Failed to send timer expired notification (backend may be hibernated):",
        error
      );
      // Don't re-throw - this is not critical for app functionality
    }
  }

  async sendHighFiveNotification(toUserId: string, friendName: string): Promise<void> {
    console.log("NotificationService: sendHighFiveNotification called for user:", toUserId);

    try {
      await api.fetch("/api/push/send", {
        method: "POST",
        body: JSON.stringify({
          userId: toUserId,
          payload: {
            type: "high_five",
            title: "", // Silent notification
            body: "", // Silent notification
            icon: "/favicon.svg",
            badge: "/favicon.svg",
            tag: "high_five",
            group: "dicey-movements",
            silent: true, // Make it silent
            data: {
              url: "/",
              timestamp: Date.now(),
              type: "high_five",
              friendName,
            },
          },
        }),
      });
    } catch (error) {
      console.warn(
        "NotificationService: Failed to send high five notification (backend may be hibernated):",
        error
      );
    }
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
    const deviceInfo = this.getDeviceInfo();
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
      deviceId: this.deviceId || "unknown",
      deviceType: deviceInfo.deviceType,
      browser: deviceInfo.browser,
      platform: deviceInfo.platform,
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

  // Clear notifications by tag or all notifications
  async clearNotifications(tag?: string): Promise<void> {
    if (!this.isSupported || !this.registration) {
      console.warn(
        "NotificationService: Cannot clear notifications - not supported or no registration"
      );
      return;
    }

    try {
      // Get all notifications
      const notifications = await this.registration.getNotifications();

      // Filter by tag if specified
      const notificationsToClose = tag
        ? notifications.filter((notification) => notification.tag === tag)
        : notifications;

      // Close each notification
      notificationsToClose.forEach((notification) => notification.close());

      console.log(
        "NotificationService: Cleared",
        notificationsToClose.length,
        "notifications",
        tag ? `with tag: ${tag}` : ""
      );
    } catch (error) {
      console.error("NotificationService: Error clearing notifications:", error);
    }
  }

  // Method to clear all notifications (for cleanup)
  async clearAllNotifications(): Promise<void> {
    if (!this.isSupported || !this.registration) {
      console.warn("NotificationService: Cannot clear notifications - not supported");
      return;
    }

    try {
      const notifications = await this.registration.getNotifications();

      notifications.forEach((notification) => {
        console.log(
          "NotificationService: Closing notification:",
          notification.title,
          "with tag:",
          notification.tag
        );
        notification.close();
      });
    } catch (error) {
      console.error("NotificationService: Error clearing all notifications:", error);
    }
  }

  // Send a silent push notification to clear notifications on all user devices
  async sendClearNotificationMessage(tag?: string): Promise<void> {
    try {
      // First, clear local notifications immediately
      await this.clearNotifications(tag);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await api.fetch("/api/push/send", {
          method: "POST",
          body: JSON.stringify({
            userId: user.id,
            payload: {
              type: "clear_notifications",
              title: "", // Empty title for silent notification
              body: "", // Empty body for silent notification
              silent: true, // Standard Web Push Protocol flag for silent notifications
              tag: tag,
              clearTag: tag,
            },
          }),
        });
      }
    } catch (error) {
      // Handle errors gracefully - don't throw, just log
      console.warn(
        "NotificationService: Failed to send clear notification message (backend may be hibernated):",
        error
      );
      // Don't re-throw - this is not critical for app functionality
    }
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

  // Method to update subscription activity
  async updateSubscriptionActivity(): Promise<void> {
    if (!this.deviceId) {
      console.warn("NotificationService: No device ID available");
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        console.warn("NotificationService: No authenticated user found");
        return;
      }

      // Call backend to update activity
      await api.updateSubscriptionActivity(user.id, this.deviceId);
      console.log("NotificationService: Subscription activity updated");
    } catch (error) {
      console.error("NotificationService: Error updating subscription activity:", error);
    }
  }
}

// Create a singleton instance
export const notificationService = new NotificationService();

// Export the class for testing
export { NotificationService };

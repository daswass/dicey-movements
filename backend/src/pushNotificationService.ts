import webpush from "web-push";
import { supabase } from "./supabaseClient";

// VAPID keys - you'll need to generate these
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "YOUR_VAPID_PUBLIC_KEY";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "YOUR_VAPID_PRIVATE_KEY";

// Configure web-push
webpush.setVapidDetails(
  process.env.VAPID_EMAIL || "mailto:your-email@example.com",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  data?: any;
}

class PushNotificationService {
  async saveSubscription(userId: string, subscription: PushSubscription): Promise<boolean> {
    try {
      const { error } = await supabase.from("push_subscriptions").upsert({
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        created_at: new Date().toISOString(),
      });

      if (error) {
        console.error("Error saving push subscription:", error);
        return false;
      }

      console.log("Push subscription saved for user:", userId);
      return true;
    } catch (error) {
      console.error("Error saving push subscription:", error);
      return false;
    }
  }

  async removeSubscription(userId: string, endpoint: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", userId)
        .eq("endpoint", endpoint);

      if (error) {
        console.error("Error removing push subscription:", error);
        return false;
      }

      console.log("Push subscription removed for user:", userId);
      return true;
    } catch (error) {
      console.error("Error removing push subscription:", error);
      return false;
    }
  }

  async sendNotification(userId: string, payload: NotificationPayload): Promise<boolean> {
    try {
      // Get user's push subscriptions
      const { data: subscriptions, error } = await supabase
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", userId);

      if (error) {
        console.error("Error fetching push subscriptions:", error);
        return false;
      }

      if (!subscriptions || subscriptions.length === 0) {
        console.log("No push subscriptions found for user:", userId);
        return false;
      }

      // Send notification to all subscriptions for this user
      const results = await Promise.allSettled(
        subscriptions.map((subscription: any) => this.sendToSubscription(subscription, payload))
      );

      const successful = results.filter(
        (result: any) => result.status === "fulfilled" && result.value
      ).length;
      const failed = results.length - successful;

      console.log(
        `Push notification sent to user ${userId}: ${successful} successful, ${failed} failed`
      );
      return successful > 0;
    } catch (error) {
      console.error("Error sending push notification:", error);
      return false;
    }
  }

  private async sendToSubscription(
    subscription: any,
    payload: NotificationPayload
  ): Promise<boolean> {
    try {
      const pushSubscription = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      };

      const result = await webpush.sendNotification(pushSubscription, JSON.stringify(payload));

      if (result.statusCode === 410) {
        // Subscription is no longer valid, remove it
        console.log("Removing invalid subscription:", subscription.endpoint);
        await this.removeSubscription(subscription.user_id, subscription.endpoint);
        return false;
      }

      return result.statusCode >= 200 && result.statusCode < 300;
    } catch (error) {
      console.error("Error sending to subscription:", error);

      // If the subscription is invalid, remove it
      if ((error as any).statusCode === 410) {
        await this.removeSubscription(subscription.user_id, subscription.endpoint);
      }

      return false;
    }
  }

  async sendTimerExpiredNotification(userId: string): Promise<boolean> {
    // Check if user has timer expired notifications enabled
    const settings = await this.getUserNotificationSettings(userId);
    if (!settings.timer_expired) {
      console.log(`Timer expired notifications disabled for user ${userId}`);
      return false;
    }

    const payload: NotificationPayload = {
      title: "⏰ Timer Expired!",
      body: "Your workout timer has finished! Time to get moving!",
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      tag: "timer-expired",
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
      },
    };

    return this.sendNotification(userId, payload);
  }

  async sendAchievementNotification(userId: string, achievementName: string): Promise<boolean> {
    // Check if user has achievement notifications enabled
    const settings = await this.getUserNotificationSettings(userId);
    if (!settings.achievements) {
      console.log(`Achievement notifications disabled for user ${userId}`);
      return false;
    }

    const payload: NotificationPayload = {
      title: "🏆 Achievement Unlocked!",
      body: `Congratulations! You've earned the "${achievementName}" achievement!`,
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      tag: "achievement",
      requireInteraction: false,
      data: {
        url: "/",
        timestamp: Date.now(),
        type: "achievement",
      },
    };

    return this.sendNotification(userId, payload);
  }

  async sendFriendRequestNotification(userId: string, friendName: string): Promise<boolean> {
    // Check if user has friend request notifications enabled
    const settings = await this.getUserNotificationSettings(userId);
    if (!settings.friend_requests) {
      console.log(`Friend request notifications disabled for user ${userId}`);
      return false;
    }

    const payload: NotificationPayload = {
      title: "👋 New Friend Request",
      body: `${friendName} wants to be your friend!`,
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      tag: "friend-request",
      requireInteraction: true,
      actions: [
        {
          action: "accept",
          title: "Accept",
          icon: "/favicon.svg",
        },
        {
          action: "decline",
          title: "Decline",
        },
      ],
      data: {
        url: "/friends",
        timestamp: Date.now(),
        type: "friend-request",
      },
    };

    return this.sendNotification(userId, payload);
  }

  async sendFriendActivityNotification(
    userId: string,
    friendName: string,
    activity: string
  ): Promise<boolean> {
    // Check if user has friend activity notifications enabled
    const settings = await this.getUserNotificationSettings(userId);
    if (!settings.friend_activity) {
      console.log(`Friend activity notifications disabled for user ${userId}`);
      return false;
    }

    const payload: NotificationPayload = {
      title: "💪 Friend Activity",
      body: `${friendName} just completed ${activity}!`,
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      tag: "friend-activity",
      requireInteraction: false,
      data: {
        url: "/friends",
        timestamp: Date.now(),
        type: "friend-activity",
      },
    };

    return this.sendNotification(userId, payload);
  }

  // Get VAPID public key for client-side subscription
  getVapidPublicKey(): string {
    return VAPID_PUBLIC_KEY;
  }

  private async getUserNotificationSettings(userId: string): Promise<{
    timer_expired: boolean;
    achievements: boolean;
    friend_activity: boolean;
    friend_requests: boolean;
  }> {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("notification_settings")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("Error fetching notification settings:", error);
        // Return default settings
        return {
          timer_expired: true,
          achievements: false,
          friend_activity: false,
          friend_requests: false,
        };
      }

      const settings = data?.notification_settings || {};
      return {
        timer_expired: settings.timer_expired ?? true,
        achievements: settings.achievements ?? false,
        friend_activity: settings.friend_activity ?? false,
        friend_requests: settings.friend_requests ?? false,
      };
    } catch (error) {
      console.error("Error getting user notification settings:", error);
      // Return default settings
      return {
        timer_expired: true,
        achievements: false,
        friend_activity: false,
        friend_requests: false,
      };
    }
  }
}

export const pushNotificationService = new PushNotificationService();

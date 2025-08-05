// Shared service for activity synchronization across components
import {
  createSupabaseChannel,
  SupabaseChannelManager,
  SUPABASE_CHANNEL_STATUS,
} from "./supabaseChannel";
import { supabase } from "./supabaseClient";

type ActivitySyncCallback = (activity: any) => void;
type OuraActivitySyncCallback = (activity: any) => void;

class ActivitySyncService {
  private listeners: Set<ActivitySyncCallback> = new Set();
  private ouraListeners: Set<OuraActivitySyncCallback> = new Set();
  private channelManager: SupabaseChannelManager;
  private isSubscribed = false;

  constructor() {
    this.channelManager = createSupabaseChannel({
      name: "activity-sync",
      supabase,
      onStatusChange: (status) => {
        this.isSubscribed = status === SUPABASE_CHANNEL_STATUS.SUBSCRIBED;
      },
      onError: (error) => {
        console.error("ActivitySyncService: Error in channel:", error);
      },
    });
  }

  // Subscribe to activity changes
  subscribe(callback: ActivitySyncCallback): () => void {
    this.listeners.add(callback);

    // Start real-time subscription if not already subscribed and page is visible
    if (!document.hidden) {
      this.startRealtimeSubscription();
    }

    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);

      // If no more listeners, stop the subscription
      if (this.listeners.size === 0 && this.ouraListeners.size === 0) {
        this.stopRealtimeSubscription();
      }
    };
  }

  // Subscribe to Oura activity changes
  subscribeToOura(callback: OuraActivitySyncCallback): () => void {
    this.ouraListeners.add(callback);

    // Start real-time subscription if not already subscribed and page is visible
    if (!document.hidden) {
      this.startRealtimeSubscription();
    }

    // Return unsubscribe function
    return () => {
      this.ouraListeners.delete(callback);

      // If no more listeners, stop the subscription
      if (this.listeners.size === 0 && this.ouraListeners.size === 0) {
        this.stopRealtimeSubscription();
      }
    };
  }

  // Start real-time subscription to activities table
  private startRealtimeSubscription(): void {
    if (this.isSubscribed || document.hidden) return;

    try {
      // Subscribe to activities table
      this.channelManager.subscribe(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activities",
        },
        (payload) => {
          this.notifyNewActivity(payload.new);
        }
      );

      // Subscribe to oura_activities table
      this.channelManager.subscribe(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "oura_activities",
        },
        (payload) => {
          this.notifyNewOuraActivity(payload.new);
        }
      );
    } catch (error) {
      console.error("ActivitySyncService: Error setting up real-time subscription:", error);
    }
  }

  // Stop real-time subscription
  private stopRealtimeSubscription(): void {
    this.channelManager.disconnect();
    this.isSubscribed = false;
  }

  // Notify all listeners of new activity
  private notifyNewActivity(activity: any): void {
    this.listeners.forEach((callback) => {
      try {
        callback(activity);
      } catch (error) {
        console.error("ActivitySyncService: Error in callback:", error);
      }
    });
  }

  // Notify all listeners of new Oura activity
  private notifyNewOuraActivity(activity: any): void {
    this.ouraListeners.forEach((callback) => {
      try {
        callback(activity);
      } catch (error) {
        console.error("ActivitySyncService: Error in Oura callback:", error);
      }
    });
  }

  // Clear all listeners and stop subscription
  clear(): void {
    this.listeners.clear();
    this.ouraListeners.clear();
    this.stopRealtimeSubscription();
  }

  // Cleanup method for consistency with TimerSyncService
  cleanup(): void {
    this.clear();
    this.channelManager.cleanup();
  }

  // Get connection status for debugging
  getConnectionStatus(): {
    isSubscribed: boolean;
    reconnectAttempts: number;
    hasListeners: boolean;
  } {
    const status = this.channelManager.getStatus();
    return {
      isSubscribed: this.isSubscribed,
      reconnectAttempts: status.reconnectAttempts,
      hasListeners: this.listeners.size > 0 || this.ouraListeners.size > 0,
    };
  }
}

// Create singleton instance
export const activitySyncService = new ActivitySyncService();

// Shared service for activity synchronization across components
import { supabase } from "./supabaseClient";

type ActivitySyncCallback = (activity: any) => void;
type OuraActivitySyncCallback = (activity: any) => void;

class ActivitySyncService {
  private listeners: Set<ActivitySyncCallback> = new Set();
  private ouraListeners: Set<OuraActivitySyncCallback> = new Set();
  private subscription: any = null;
  private isSubscribed = false;

  // Subscribe to activity changes
  subscribe(callback: ActivitySyncCallback): () => void {
    this.listeners.add(callback);

    // Start real-time subscription if not already subscribed
    this.startRealtimeSubscription();

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

    // Start real-time subscription if not already subscribed
    this.startRealtimeSubscription();

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
    if (this.isSubscribed) return;

    try {
      this.subscription = supabase
        .channel("activity-sync")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "activities",
          },
          (payload) => {
            console.log("ActivitySyncService: New activity detected:", payload);
            this.notifyNewActivity(payload.new);
          }
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "oura_activities",
          },
          (payload) => {
            console.log("ActivitySyncService: New Oura activity detected:", payload);
            this.notifyNewOuraActivity(payload.new);
          }
        )
        .subscribe((status) => {
          console.log("ActivitySyncService: Real-time subscription status:", status);
          this.isSubscribed = status === "SUBSCRIBED";
        });
    } catch (error) {
      console.error("ActivitySyncService: Error setting up real-time subscription:", error);
    }
  }

  // Stop real-time subscription
  private stopRealtimeSubscription(): void {
    if (this.subscription) {
      try {
        supabase.removeChannel(this.subscription);
      } catch (error) {
        console.warn("ActivitySyncService: Error removing channel:", error);
      }
      this.subscription = null;
      this.isSubscribed = false;
    }
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
}

// Create singleton instance
export const activitySyncService = new ActivitySyncService();

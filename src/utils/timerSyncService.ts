import { createSupabaseChannel, SupabaseChannelManager } from "./supabaseChannel";
import { supabase } from "./supabaseClient";

export interface TimerState {
  masterDeviceId: string | null;
  startTime: string | null;
  duration: number;
  lastUpdated: string;
}

export interface TimerSyncUpdate {
  masterDeviceId: string;
  startTime: string;
  duration: number;
}

class TimerSyncService {
  private deviceId: string;
  private syncInterval: NodeJS.Timeout | null = null;
  private isMaster: boolean = false;
  private lastSyncTime: string | null = null;
  private channelManager: SupabaseChannelManager;
  private masterStatusCallbacks: Set<(isMaster: boolean) => void> = new Set();
  private currentStateChangeCallback: ((state: TimerState) => void) | null = null;

  constructor() {
    this.deviceId = this.generateDeviceId();
    this.channelManager = createSupabaseChannel({
      name: "timer-sync",
      supabase,
      onStatusChange: (status) => {},
      onError: (error) => {
        console.error("TimerSyncService: Error in channel:", error);
      },
    });
  }

  private generateDeviceId(): string {
    // Use the same device ID generation as notification service
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      ctx?.fillText("Device fingerprint", 10, 10);
      const fingerprint = canvas.toDataURL();

      const characteristics = [
        navigator.userAgent,
        navigator.language,
        screen.width + "x" + screen.height,
        new Date().getTimezoneOffset(),
        fingerprint,
      ].join("|");

      let hash = 0;
      for (let i = 0; i < characteristics.length; i++) {
        const char = characteristics.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
      }

      return Math.abs(hash).toString(36);
    } catch (error) {
      console.error("TimerSyncService: Error generating device ID:", error);
      return "unknown";
    }
  }

  // Start timer sync (become master)
  async startTimerSync(duration: number): Promise<boolean> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return false;

      const now = new Date().toISOString();

      const { error } = await supabase
        .from("profiles")
        .update({
          timer_master_device_id: this.deviceId,
          timer_start_time: now,
          timer_duration: duration, // Use existing timer_duration field
          timer_last_updated: now,
        })
        .eq("id", user.id);

      if (error) {
        console.error("TimerSyncService: Error starting timer sync:", error);
        return false;
      }

      this.isMaster = true;
      this.lastSyncTime = now;
      console.log("TimerSyncService: Started timer sync as master");
      return true;
    } catch (error) {
      console.error("TimerSyncService: Error starting timer sync:", error);
      return false;
    }
  }

  async stopTimerSync(): Promise<boolean> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await supabase
        .from("profiles")
        .update({
          timer_master_device_id: null,
          timer_last_updated: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) {
        console.error("TimerSyncService: Error stopping timer sync:", error);
        return false;
      }

      this.isMaster = false;
      this.lastSyncTime = null;
      console.log("TimerSyncService: Stopped timer sync");
      return true;
    } catch (error) {
      console.error("TimerSyncService: Error stopping timer sync:", error);
      return false;
    }
  }

  // Transfer master to this device
  async becomeMaster(): Promise<boolean> {
    try {
      if (this.isMaster) {
        return true;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return false;

      // First, get current timer state to see if we need to set start time
      const currentState = await this.getTimerState();
      const now = new Date().toISOString();

      let updateData: any = {
        timer_master_device_id: this.deviceId,
        timer_last_updated: now,
      };

      if (!currentState?.startTime && (currentState?.duration || 0) > 0) {
        updateData.timer_start_time = now;
        console.log("TimerSyncService: Setting start time");
      }

      const { error } = await supabase.from("profiles").update(updateData).eq("id", user.id);

      if (error) {
        console.error("TimerSyncService: Error becoming master:", error);
        return false;
      }

      this.isMaster = true;
      this.lastSyncTime = now;
      console.log("TimerSyncService: Became master");
      this.notifyMasterStatusChange(true);
      return true;
    } catch (error) {
      console.error("TimerSyncService: Error becoming master:", error);
      return false;
    }
  }

  async getTimerState(): Promise<TimerState | null> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("timer_master_device_id, timer_start_time, timer_duration, timer_last_updated")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("TimerSyncService: Error getting timer state:", error);
        return null;
      }

      return {
        masterDeviceId: data.timer_master_device_id,
        startTime: data.timer_start_time,
        duration: data.timer_duration || 0,
        lastUpdated: data.timer_last_updated,
      };
    } catch (error) {
      console.error("TimerSyncService: Error getting timer state:", error);
      return null;
    }
  }

  // Start real-time subscription for timer updates
  startPolling(onStateChange: (state: TimerState) => void, intervalMs: number = 5000): void {
    // Prevent multiple subscriptions
    if (this.channelManager.getStatus().isConnected || this.syncInterval) {
      return;
    }

    // Store the callback for reconnection purposes
    this.currentStateChangeCallback = onStateChange;

    // Don't get initial state here - let the normal initialization flow handle it

    // Set up real-time subscription
    this.setupRealtimeSubscription(onStateChange).catch((error) => {
      console.error("TimerSyncService: Error setting up real-time subscription:", error);
    });

    // Fallback polling as backup (much longer interval)
    this.syncInterval = setInterval(async () => {
      const state = await this.getTimerState();
      if (state && state.lastUpdated !== this.lastSyncTime) {
        this.handleStateChange(state, onStateChange);
      }
    }, 30000); // 30 seconds as backup
  }

  private async setupRealtimeSubscription(
    onStateChange: (state: TimerState) => void
  ): Promise<void> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      this.channelManager.subscribe(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          const newData = payload.new as any;
          const state: TimerState = {
            masterDeviceId: newData.timer_master_device_id,
            startTime: newData.timer_start_time,
            duration: newData.timer_duration || 0,
            lastUpdated: newData.timer_last_updated,
          };

          this.handleStateChange(state, onStateChange);
        }
      );
    } catch (error) {
      console.error("TimerSyncService: Error setting up real-time subscription:", error);
    }
  }

  private handleStateChange(state: TimerState, onStateChange: (state: TimerState) => void): void {
    // Prevent duplicate processing of the same state
    if (state.lastUpdated === this.lastSyncTime) {
      return;
    }

    this.lastSyncTime = state.lastUpdated;

    // Check if we're still the master
    const wasMaster = this.isMaster;
    this.isMaster = state.masterDeviceId === this.deviceId;

    if (wasMaster !== this.isMaster) {
      this.notifyMasterStatusChange(this.isMaster);
    }

    onStateChange(state);
  }

  stopPolling(): void {
    // Stop polling interval
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    // Stop real-time subscription
    this.channelManager.disconnect();

    // Reset state
    this.currentStateChangeCallback = null;
  }

  async isDeviceMaster(): Promise<boolean> {
    // If we already know we're master, return true
    if (this.isMaster) {
      return true;
    }

    // Check database to see if this device is actually the master
    try {
      const state = await this.getTimerState();
      if (state && state.masterDeviceId === this.deviceId) {
        this.isMaster = true;
        return true;
      }
      // Update local state to reflect current database state
      this.isMaster = false;
      return false;
    } catch (error) {
      console.error("TimerSyncService: Error checking master status:", error);
      return false;
    }
  }

  // Synchronous version for backward compatibility
  isDeviceMasterSync(): boolean {
    return this.isMaster;
  }

  getDeviceId(): string {
    return this.deviceId;
  }

  // Subscribe to master status changes
  onMasterStatusChange(callback: (isMaster: boolean) => void): () => void {
    this.masterStatusCallbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.masterStatusCallbacks.delete(callback);
    };
  }

  // Notify all master status callbacks
  private notifyMasterStatusChange(isMaster: boolean): void {
    this.masterStatusCallbacks.forEach((callback) => {
      try {
        callback(isMaster);
      } catch (error) {
        console.error("TimerSyncService: Error in master status callback:", error);
      }
    });
  }

  // Cleanup method to remove event listeners
  cleanup(): void {
    this.stopPolling();
    this.channelManager.cleanup();
  }

  // Get connection status for debugging
  getConnectionStatus(): {
    hasSubscription: boolean;
    reconnectAttempts: number;
    hasCallback: boolean;
  } {
    const status = this.channelManager.getStatus();
    return {
      hasSubscription: status.isConnected,
      reconnectAttempts: status.reconnectAttempts,
      hasCallback: !!this.currentStateChangeCallback,
    };
  }
}

// Create singleton instance
export const timerSyncService = new TimerSyncService();

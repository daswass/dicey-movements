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

  constructor() {
    this.deviceId = this.generateDeviceId();
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

  // Stop timer sync (release master)
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
          timer_start_time: null,
          timer_last_updated: new Date().toISOString(),
          // Don't clear timer_duration - it's a user setting
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

      // If there's no start time but there is a duration, set the start time
      if (!currentState?.startTime && (currentState?.duration || 0) > 0) {
        updateData.timer_start_time = now;
        console.log("TimerSyncService: Setting start time when becoming master");
      }

      const { error } = await supabase.from("profiles").update(updateData).eq("id", user.id);

      if (error) {
        console.error("TimerSyncService: Error becoming master:", error);
        return false;
      }

      this.isMaster = true;
      this.lastSyncTime = now;
      console.log("TimerSyncService: Became master");
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

  // Start polling for timer updates (slave mode)
  startPolling(onStateChange: (state: TimerState) => void, intervalMs: number = 2000): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      const state = await this.getTimerState();
      if (state && state.lastUpdated !== this.lastSyncTime) {
        console.log("TimerSyncService: State changed, calling onStateChange:", {
          masterDeviceId: state.masterDeviceId,
          startTime: state.startTime,
          duration: state.duration,
          isMaster: this.isMaster,
          deviceId: this.deviceId,
        });
        this.lastSyncTime = state.lastUpdated;
        onStateChange(state);
      }
    }, intervalMs);

    console.log("TimerSyncService: Started polling for timer updates");
  }

  stopPolling(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    console.log("TimerSyncService: Stopped polling");
  }

  isDeviceMaster(): boolean {
    return this.isMaster;
  }

  getDeviceId(): string {
    return this.deviceId;
  }
}

// Create singleton instance
export const timerSyncService = new TimerSyncService();

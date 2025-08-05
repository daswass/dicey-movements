import { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

// Supabase channel status constants (actual channel statuses from Supabase)
export const SUPABASE_CHANNEL_STATUS = {
  SUBSCRIBED: "SUBSCRIBED",
  CHANNEL_ERROR: "CHANNEL_ERROR",
  TIMED_OUT: "TIMED_OUT",
  CLOSED: "CLOSED",
} as const;

// UI display status constants (for component display logic)
export const UI_STATUS = {
  CONNECTING: "connecting",
  DISCONNECTED: "disconnected",
  ERROR: "error",
  TIMEOUT: "timeout",
  CLOSED: "closed",
} as const;

export type SupabaseChannelStatus =
  (typeof SUPABASE_CHANNEL_STATUS)[keyof typeof SUPABASE_CHANNEL_STATUS];
export type UIStatus = (typeof UI_STATUS)[keyof typeof UI_STATUS];

export interface ChannelConfig {
  name: string;
  supabase: SupabaseClient;
  onStatusChange?: (status: string) => void;
  onError?: (error: Error) => void;
  maxReconnectAttempts?: number;
  initialReconnectDelay?: number;
}

export interface ChannelSubscription {
  channel: RealtimeChannel;
  isConnected: boolean;
  reconnectAttempts: number;
  disconnect: () => void;
  getStatus: () => { isConnected: boolean; reconnectAttempts: number };
}

/**
 * SupabaseChannelManager - A reusable wrapper for Supabase real-time channels
 * with automatic reconnection, visibility handling, and network status monitoring.
 *
 * Usage example:
 *
 * ```typescript
 * const channelManager = createSupabaseChannel({
 *   name: "my-channel",
 *   supabase,
 *   onStatusChange: (status) => console.log("Status:", status),
 *   onError: (error) => console.error("Error:", error),
 * });
 *
 * // Subscribe to table changes
 * channelManager.subscribe(
 *   "postgres_changes",
 *   {
 *     event: "INSERT",
 *     schema: "public",
 *     table: "my_table",
 *   },
 *   (payload) => {
 *     console.log("New record:", payload.new);
 *   }
 * );
 *
 * // Cleanup when done
 * channelManager.cleanup();
 * ```
 */
export class SupabaseChannelManager {
  private channel: RealtimeChannel | null = null;
  private isConnected = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts: number;
  private reconnectDelay: number;
  private supabase: SupabaseClient;
  private channelName: string;
  private onStatusChange?: (status: string) => void;
  private onError?: (error: Error) => void;
  private visibilityChangeHandler: (() => void) | null = null;
  private onlineHandler: (() => void) | null = null;
  private isActive = false;
  private wasConnectedBeforeHidden = false;
  private isPermanentlyDisconnected = false;
  private subscriptions: Array<{
    event: string;
    filter: any;
    callback: (payload: any) => void;
  }> = [];

  constructor(config: ChannelConfig) {
    this.supabase = config.supabase;
    this.channelName = config.name;
    this.onStatusChange = config.onStatusChange;
    this.onError = config.onError;
    this.maxReconnectAttempts = config.maxReconnectAttempts || 5;
    this.reconnectDelay = config.initialReconnectDelay || 1000;

    this.setupVisibilityListener();
    this.setupNetworkListener();
  }

  private setupVisibilityListener(): void {
    this.visibilityChangeHandler = () => {
      if (document.hidden) {
        // Page became hidden - disconnect to save resources
        if (this.isConnected) {
          console.log(`${this.channelName}: Page hidden, disconnecting to save resources`);
          this.wasConnectedBeforeHidden = true;
          this.temporarilyDisconnect();
        } else {
          console.log(`${this.channelName}: Page hidden, but not connected - no action needed`);
        }
      } else {
        // Page became visible - reconnect if we had an active connection before
        if (
          this.wasConnectedBeforeHidden &&
          this.isActive &&
          this.subscriptions.length > 0 &&
          !this.isPermanentlyDisconnected
        ) {
          console.log(`${this.channelName}: Page visible, reconnecting...`);
          this.wasConnectedBeforeHidden = false;
          // Reset reconnection attempts and start fresh
          this.reconnectAttempts = 0;
          if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
          }
          this.createChannel();
        } else {
          console.log(
            `${this.channelName}: Page visible, but no reconnection needed (wasConnected: ${this.wasConnectedBeforeHidden}, isActive: ${this.isActive}, subscriptions: ${this.subscriptions.length}, permanentlyDisconnected: ${this.isPermanentlyDisconnected})`
          );
        }
      }
    };

    document.addEventListener("visibilitychange", this.visibilityChangeHandler);
  }

  private setupNetworkListener(): void {
    this.onlineHandler = () => {
      if (
        this.isActive &&
        !document.hidden &&
        this.subscriptions.length > 0 &&
        !this.isPermanentlyDisconnected
      ) {
        // Network came back online and channel is active, check connection
        if (!this.isConnected) {
          console.log(`${this.channelName}: Network came back online, reconnecting...`);
          // Reset reconnection attempts and start fresh
          this.reconnectAttempts = 0;
          if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
          }
          this.createChannel();
        }
      }
    };

    window.addEventListener("online", this.onlineHandler);
  }

  /**
   * Subscribe to a real-time event
   * @param event - The event type (e.g., "postgres_changes")
   * @param filter - The filter configuration
   * @param callback - The callback function to handle events
   * @returns ChannelSubscription object with status and disconnect method
   */
  subscribe(event: string, filter: any, callback: (payload: any) => void): ChannelSubscription {
    // Store the subscription for potential reconnection
    this.subscriptions.push({ event, filter, callback });

    // Only create channel if page is visible and not permanently disconnected
    if (!document.hidden && !this.isPermanentlyDisconnected) {
      if (this.channel) {
        // Add to existing channel
        (this.channel as any).on(event, filter, callback);
      } else {
        // Create new channel
        this.createChannel();
      }
    }

    return {
      channel: this.channel!,
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      disconnect: () => this.disconnect(),
      getStatus: () => this.getStatus(),
    };
  }

  private createChannel(): void {
    // Don't create channel if page is hidden or permanently disconnected
    if (document.hidden || this.isPermanentlyDisconnected) {
      console.log(
        `${this.channelName}: Skipping channel creation - page is hidden or permanently disconnected`
      );
      return;
    }

    if (this.channel) {
      console.warn(`${this.channelName}: Channel already exists, disconnecting first`);
      this.disconnect();
    }

    this.isActive = true;

    try {
      this.channel = this.supabase.channel(this.channelName);

      // Add all stored subscriptions
      this.subscriptions.forEach(({ event, filter, callback }) => {
        (this.channel as any).on(event, filter, callback);
      });

      this.channel.subscribe((status) => {
        this.isConnected = status === SUPABASE_CHANNEL_STATUS.SUBSCRIBED;

        if (this.onStatusChange) {
          this.onStatusChange(status);
        }

        // Handle connection status changes
        if (status === SUPABASE_CHANNEL_STATUS.SUBSCRIBED) {
          // Reset reconnect attempts on successful connection
          this.reconnectAttempts = 0;
          if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
          }
        } else if (
          status === SUPABASE_CHANNEL_STATUS.CHANNEL_ERROR ||
          status === SUPABASE_CHANNEL_STATUS.TIMED_OUT
        ) {
          // Only attempt to reconnect if page is visible and not permanently disconnected
          if (!document.hidden && !this.isPermanentlyDisconnected) {
            this.handleReconnection();
          }
        }
      });
    } catch (error) {
      console.error(`${this.channelName}: Error setting up real-time subscription:`, error);
      if (this.onError) {
        this.onError(error as Error);
      }
      // Only attempt to reconnect if page is visible and not permanently disconnected
      if (!document.hidden && !this.isPermanentlyDisconnected) {
        this.handleReconnection();
      }
    }
  }

  private handleReconnection(): void {
    // Don't reconnect if page is hidden or permanently disconnected
    if (document.hidden || this.isPermanentlyDisconnected) {
      console.log(
        `${this.channelName}: Skipping reconnection - page is hidden or permanently disconnected`
      );
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`${this.channelName}: Max reconnection attempts reached`);
      return;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff

    console.log(
      `${this.channelName}: Reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );

    this.reconnectTimeout = setTimeout(() => {
      // Check again if page is still visible before reconnecting
      if (!document.hidden && !this.isPermanentlyDisconnected) {
        this.isConnected = false;
        this.channel = null;
        // Recreate the channel with all stored subscriptions
        if (this.subscriptions.length > 0) {
          this.createChannel();
        }
      }
    }, delay);
  }

  /**
   * Temporarily disconnect (for visibility changes)
   */
  temporarilyDisconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.channel) {
      try {
        this.supabase.removeChannel(this.channel);
      } catch (error) {
        console.warn(`${this.channelName}: Error removing channel:`, error);
      }
      this.channel = null;
      this.isConnected = false;
    }

    // Reset reconnect state but keep isActive true
    this.reconnectAttempts = 0;
  }

  /**
   * Disconnect the channel and stop all subscriptions
   */
  disconnect(): void {
    this.isActive = false;
    this.isPermanentlyDisconnected = true;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.channel) {
      try {
        this.supabase.removeChannel(this.channel);
      } catch (error) {
        console.warn(`${this.channelName}: Error removing channel:`, error);
      }
      this.channel = null;
      this.isConnected = false;
    }

    // Reset reconnect state
    this.reconnectAttempts = 0;
  }

  /**
   * Get the current connection status
   */
  getStatus(): { isConnected: boolean; reconnectAttempts: number } {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  /**
   * Cleanup the channel manager and remove all event listeners
   */
  cleanup(): void {
    this.disconnect();
    this.subscriptions = [];
    this.wasConnectedBeforeHidden = false;

    // Remove event listeners
    if (this.visibilityChangeHandler) {
      document.removeEventListener("visibilitychange", this.visibilityChangeHandler);
      this.visibilityChangeHandler = null;
    }

    if (this.onlineHandler) {
      window.removeEventListener("online", this.onlineHandler);
      this.onlineHandler = null;
    }
  }
}

/**
 * Factory function to create a SupabaseChannelManager
 * @param config - Configuration for the channel manager
 * @returns A new SupabaseChannelManager instance
 */
export function createSupabaseChannel(config: ChannelConfig): SupabaseChannelManager {
  return new SupabaseChannelManager(config);
}

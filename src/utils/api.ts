import { UserProfile, LeaderboardEntry, FriendActivity } from "../types/social";

// API configuration for backend endpoints
const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "https://dicey-movements-backend.onrender.com";

export const api = {
  baseUrl: BACKEND_URL,

  // Helper function to make API calls
  async fetch(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  },

  // Health check function to wake up hibernated backend
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`);
      return response.ok;
    } catch (error) {
      console.warn("API: Health check failed:", error);
      return false;
    }
  },

  // Specific API methods
  async getVapidPublicKey() {
    return this.fetch("/api/push/vapid-public-key");
  },

  async subscribeToPush(userId: string, subscription: any) {
    return this.fetch("/api/push/subscribe", {
      method: "POST",
      body: JSON.stringify({ userId, subscription }),
    });
  },

  async unsubscribeFromPush(userId: string, endpoint: string) {
    return this.fetch("/api/push/unsubscribe", {
      method: "DELETE",
      body: JSON.stringify({ userId, endpoint }),
    });
  },

  async updateSubscriptionActivity(userId: string, deviceId: string) {
    return this.fetch("/api/push/activity", {
      method: "PUT",
      body: JSON.stringify({ userId, deviceId }),
    });
  },

  async updateNotificationSetting(userId: string, setting: string, enabled: boolean) {
    return this.fetch(`/api/notifications/settings/${userId}`, {
      method: "PUT",
      body: JSON.stringify({ setting, enabled }),
    });
  },

  async completeWorkout(userId: string, exercise: string, reps: number, multipliers?: any) {
    return this.fetch("/api/workout/complete", {
      method: "POST",
      body: JSON.stringify({ userId, exercise, reps, multipliers }),
    });
  },
};

export const fetchLeaderboard = async (location: string): Promise<LeaderboardEntry[]> => {
  const response = await fetch(`${BACKEND_URL}/api/leaderboard/${encodeURIComponent(location)}`);
  if (!response.ok) {
    throw new Error("Failed to fetch leaderboard");
  }
  return response.json();
};

export const fetchUserProfile = async (userId: string): Promise<UserProfile> => {
  const response = await fetch(`${BACKEND_URL}/api/profile/${userId}`);
  if (!response.ok) {
    throw new Error("Failed to fetch user profile");
  }
  return response.json();
};

export const fetchFriendActivities = async (userId: string): Promise<FriendActivity[]> => {
  const response = await fetch(`${BACKEND_URL}/api/friends/activity/${userId}`);
  if (!response.ok) {
    throw new Error("Failed to fetch friend activities");
  }
  return response.json();
};

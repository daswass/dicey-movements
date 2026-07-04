import { supabase } from "./supabaseClient";

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "https://dicey-movements-backend.onrender.com";

async function getAuthHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  return headers;
}

export const api = {
  baseUrl: BACKEND_URL,

  async fetch(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const authHeaders = await getAuthHeaders();
    const response = await fetch(url, {
      ...options,
      headers: {
        ...authHeaders,
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  },

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`);
      return response.ok;
    } catch (error) {
      console.warn("API: Health check failed:", error);
      return false;
    }
  },

  async getVapidPublicKey() {
    return this.fetch("/api/push/vapid-public-key");
  },

  async subscribeToPush(userId: string, subscription: PushSubscriptionJSON) {
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

  async completeWorkout(userId: string, exercise: string, reps: number, multipliers?: unknown) {
    return this.fetch("/api/workout/complete", {
      method: "POST",
      body: JSON.stringify({ userId, exercise, reps, multipliers }),
    });
  },
};

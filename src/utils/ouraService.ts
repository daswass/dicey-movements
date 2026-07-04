import { supabase } from "./supabaseClient";

const API_BASE_URL =
  import.meta.env.VITE_BACKEND_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "https://dicey-movements-backend.onrender.com";

async function authHeaders(): Promise<HeadersInit> {
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

export interface OuraStatus {
  connected: boolean;
  hasValidToken: boolean;
}

export class OuraService {
  static async getAuthUrl(): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/api/oura/auth-url`, {
      headers: await authHeaders(),
    });
    if (!response.ok) {
      throw new Error("Failed to get authorization URL");
    }
    const data = await response.json();
    return data.authUrl;
  }

  static async getStatus(userId: string): Promise<OuraStatus> {
    const response = await fetch(`${API_BASE_URL}/api/oura/status/${userId}`, {
      headers: await authHeaders(),
    });
    if (!response.ok) {
      throw new Error("Failed to check Oura status");
    }
    return response.json();
  }

  static async syncActivity(userId: string, days: number = 7): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/oura/sync/${userId}`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ days }),
    });

    if (!response.ok) {
      throw new Error("Failed to sync activity data");
    }
  }

  static async disconnect(userId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/oura/disconnect/${userId}`, {
      method: "DELETE",
      headers: await authHeaders(),
    });

    if (!response.ok) {
      throw new Error("Failed to disconnect Oura integration");
    }
  }

  static async handleCallback(code: string, state: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/oura/callback?code=${code}&state=${state}`);
    if (!response.ok) {
      throw new Error("Failed to complete Oura integration");
    }
  }
}

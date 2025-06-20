import { supabase } from "./supabaseClient";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

export interface OuraStatus {
  connected: boolean;
  hasValidToken: boolean;
}

export class OuraService {
  // Get Oura authorization URL
  static async getAuthUrl(userId: string): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/api/oura/auth-url?userId=${userId}`);
    if (!response.ok) {
      throw new Error("Failed to get authorization URL");
    }
    const data = await response.json();
    return data.authUrl;
  }

  // Check Oura connection status
  static async getStatus(userId: string): Promise<OuraStatus> {
    const response = await fetch(`${API_BASE_URL}/api/oura/status/${userId}`);
    if (!response.ok) {
      throw new Error("Failed to check Oura status");
    }
    return response.json();
  }

  // Sync Oura activity data
  static async syncActivity(userId: string, days: number = 7): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/oura/sync/${userId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ days }),
    });

    if (!response.ok) {
      throw new Error("Failed to sync activity data");
    }
  }

  // Disconnect Oura integration
  static async disconnect(userId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/oura/disconnect/${userId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error("Failed to disconnect Oura integration");
    }
  }

  // Handle OAuth callback
  static async handleCallback(code: string, state: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/oura/callback?code=${code}&state=${state}`);
    if (!response.ok) {
      throw new Error("Failed to complete Oura integration");
    }
  }
}

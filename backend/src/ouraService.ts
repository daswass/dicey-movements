import axios from "axios";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Load environment variables first
dotenv.config();

// Initialize Supabase client with fallback for testing
const supabaseUrl = process.env.SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-key";
const supabase = createClient(supabaseUrl, supabaseKey);

// Oura API configuration with fallbacks for testing
const OURA_CLIENT_ID = process.env.OURA_CLIENT_ID || "placeholder-client-id";
const OURA_CLIENT_SECRET = process.env.OURA_CLIENT_SECRET || "placeholder-secret";
const OURA_REDIRECT_URI = process.env.OURA_REDIRECT_URI || "http://localhost:3000/oura/callback";
const OURA_API_BASE_URL = "https://api.ouraring.com/v2";

// Debug logging
console.log("🔍 Environment Variables Debug:");
console.log("OURA_CLIENT_ID:", OURA_CLIENT_ID);
console.log("OURA_CLIENT_SECRET:", OURA_CLIENT_SECRET ? "***SET***" : "NOT SET");
console.log("OURA_REDIRECT_URI:", OURA_REDIRECT_URI);
console.log("SUPABASE_URL:", supabaseUrl);
console.log("SUPABASE_KEY:", supabaseKey ? "***SET***" : "NOT SET");

interface OuraTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

interface OuraActivityData {
  data: Array<{
    day: string;
    steps: number;
    calories_active: number;
    calories_total: number;
    distance: number;
  }>;
}

export class OuraService {
  // Generate OAuth authorization URL
  static getAuthorizationUrl(state: string): string {
    console.log("🔗 Generating auth URL with client_id:", OURA_CLIENT_ID);
    const params = new URLSearchParams({
      client_id: OURA_CLIENT_ID,
      redirect_uri: OURA_REDIRECT_URI,
      response_type: "code",
      scope: "daily heartrate personal",
      state: state,
    });

    return `https://cloud.ouraring.com/oauth/authorize?${params.toString()}`;
  }

  // Exchange authorization code for access token
  static async exchangeCodeForToken(code: string): Promise<OuraTokenResponse> {
    const response = await axios.post("https://api.ouraring.com/oauth/token", {
      grant_type: "authorization_code",
      code: code,
      client_id: OURA_CLIENT_ID,
      client_secret: OURA_CLIENT_SECRET,
      redirect_uri: OURA_REDIRECT_URI,
    });

    return response.data;
  }

  // Refresh access token
  static async refreshToken(refreshToken: string): Promise<OuraTokenResponse> {
    const response = await axios.post("https://api.ouraring.com/oauth/token", {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: OURA_CLIENT_ID,
      client_secret: OURA_CLIENT_SECRET,
    });

    return response.data;
  }

  // Get daily activity data from Oura API
  static async getDailyActivity(
    accessToken: string,
    startDate: string,
    endDate: string
  ): Promise<OuraActivityData> {
    const response = await axios.get(`${OURA_API_BASE_URL}/usercollection/daily_activity`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      params: {
        start_date: startDate,
        end_date: endDate,
      },
    });

    return response.data;
  }

  // Save Oura tokens to database
  static async saveTokens(userId: string, tokenData: OuraTokenResponse): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

    const { error } = await supabase.from("oura_tokens").upsert({
      user_id: userId,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_type: tokenData.token_type,
      expires_at: expiresAt.toISOString(),
    });

    if (error) {
      throw new Error(`Failed to save Oura tokens: ${error.message}`);
    }
  }

  // Get stored tokens for a user
  static async getTokens(userId: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_at: string;
  } | null> {
    const { data, error } = await supabase
      .from("oura_tokens")
      .select("access_token, refresh_token, expires_at")
      .eq("user_id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // No tokens found
      }
      throw new Error(`Failed to get Oura tokens: ${error.message}`);
    }

    return data;
  }

  // Check if token is expired
  static isTokenExpired(expiresAt: string): boolean {
    return new Date(expiresAt) <= new Date();
  }

  // Get valid access token (refresh if needed)
  static async getValidAccessToken(userId: string): Promise<string> {
    const tokens = await this.getTokens(userId);
    if (!tokens) {
      throw new Error("No Oura tokens found for user");
    }

    if (this.isTokenExpired(tokens.expires_at)) {
      // Token is expired, refresh it
      const newTokens = await this.refreshToken(tokens.refresh_token);
      await this.saveTokens(userId, newTokens);
      return newTokens.access_token;
    }

    return tokens.access_token;
  }

  // Sync Oura activity data for a user
  static async syncUserActivity(userId: string, days: number = 7): Promise<void> {
    try {
      const accessToken = await this.getValidAccessToken(userId);

      const endDate = new Date().toISOString().split("T")[0];
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString().split("T")[0];

      const activityData = await this.getDailyActivity(accessToken, startDateStr, endDate);

      // Save activity data to database
      for (const activity of activityData.data) {
        const { error } = await supabase.from("oura_activities").upsert({
          user_id: userId,
          date: activity.day,
          steps: activity.steps,
          calories_active: activity.calories_active,
          calories_total: activity.calories_total,
          distance: activity.distance,
        });

        if (error) {
          console.error(`Failed to save activity for ${activity.day}:`, error);
        }
      }
    } catch (error) {
      console.error(`Failed to sync Oura activity for user ${userId}:`, error);
      throw error;
    }
  }

  // Get total steps for a user in a date range
  static async getTotalSteps(userId: string, startDate: string, endDate: string): Promise<number> {
    const { data, error } = await supabase
      .from("oura_activities")
      .select("steps")
      .eq("user_id", userId)
      .gte("date", startDate)
      .lte("date", endDate);

    if (error) {
      throw new Error(`Failed to get total steps: ${error.message}`);
    }

    return data.reduce((total, activity) => total + activity.steps, 0);
  }

  // Disconnect Oura integration for a user
  static async disconnectUser(userId: string): Promise<void> {
    const { error } = await supabase.from("oura_tokens").delete().eq("user_id", userId);

    if (error) {
      throw new Error(`Failed to disconnect Oura: ${error.message}`);
    }
  }
}

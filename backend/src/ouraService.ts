import { createClient } from "@supabase/supabase-js";
import axios from "axios";
import { randomBytes } from "crypto";
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
const OURA_REDIRECT_URI =
  process.env.OURA_REDIRECT_URI || "http://localhost:3000/api/oura/callback";
const OURA_API_BASE_URL = "https://api.ouraring.com/v2";
const OURA_WEBHOOK_URL = process.env.OURA_WEBHOOK_URL || "http://localhost:3000/api/oura/webhook";
const OURA_WEBHOOK_VERIFICATION_TOKEN =
  process.env.OURA_WEBHOOK_VERIFICATION_TOKEN || "placeholder-verification-token";

// Debug logging
console.log("🔍 Environment Variables Debug:");
console.log("OURA_CLIENT_ID:", OURA_CLIENT_ID);
console.log("OURA_CLIENT_SECRET:", OURA_CLIENT_SECRET ? "***SET***" : "NOT SET");
console.log("OURA_REDIRECT_URI:", OURA_REDIRECT_URI);
console.log("OURA_WEBHOOK_URL:", OURA_WEBHOOK_URL);
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
    id: string;
    day: string;
    steps: number;
    active_calories: number;
    total_calories: number;
    equivalent_walking_distance: number;
    score: number;
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
    try {
      const params = new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        client_id: OURA_CLIENT_ID,
        client_secret: OURA_CLIENT_SECRET,
        redirect_uri: OURA_REDIRECT_URI,
      });

      console.log("🔄 Exchanging code for token with params:", {
        grant_type: "authorization_code",
        code: "***REDACTED***",
        client_id: OURA_CLIENT_ID,
        redirect_uri: OURA_REDIRECT_URI,
      });

      const response = await axios.post("https://api.ouraring.com/oauth/token", params.toString(), {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        console.error("Oura API Error:", {
          status: error.response.status,
          data: error.response.data,
        });
        throw new Error(`Oura API Error: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  // Refresh access token
  static async refreshToken(refreshToken: string): Promise<OuraTokenResponse> {
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: OURA_CLIENT_ID,
      client_secret: OURA_CLIENT_SECRET,
    });

    const response = await axios.post("https://api.ouraring.com/oauth/token", params.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
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
        end_date: startDate === endDate ? undefined : endDate,
      },
    });

    return response.data;
  }

  // Get user's personal info from Oura API (includes Oura user ID)
  static async getPersonalInfo(accessToken: string): Promise<{ id: string }> {
    const response = await axios.get(`${OURA_API_BASE_URL}/usercollection/personal_info`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return response.data;
  }

  // Save Oura tokens to database
  static async saveTokens(
    userId: string,
    tokenData: OuraTokenResponse,
    ouraUserId: string
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
    const { error } = await supabase.from("oura_tokens").upsert(
      {
        user_id: userId,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: expiresAt,
        oura_user_id: ouraUserId,
      },
      { onConflict: "user_id" }
    );

    if (error) {
      throw new Error(`Failed to save Oura tokens: ${error.message}`);
    }
  }

  // Get tokens for a user
  static async getTokens(userId: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_at: string;
    oura_user_id: string;
  } | null> {
    const { data, error } = await supabase
      .from("oura_tokens")
      .select("access_token, refresh_token, expires_at, oura_user_id")
      .eq("user_id", userId)
      .single();

    if (error) {
      if (error.code !== "PGRST116") {
        console.error("Error fetching tokens:", error);
      }
      return null;
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
      // Persist the existing oura_user_id during token refresh
      await this.saveTokens(userId, newTokens, tokens.oura_user_id);
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
        const { error } = await supabase.from("oura_activities").upsert(
          {
            user_id: userId,
            date: activity.day,
            steps: activity.steps,
            calories_active: activity.active_calories,
            calories_total: activity.total_calories,
            distance: activity.equivalent_walking_distance,
          },
          { onConflict: "user_id, date" }
        );

        if (error) {
          console.error(`Failed to save activity for ${activity.day}:`, error);
        }
      }
    } catch (error) {
      console.error(`Failed to sync Oura activity for user ${userId}:`, error);
      throw error;
    }
  }

  // Disconnect Oura integration for a user
  static async disconnectUser(userId: string): Promise<void> {
    const { error } = await supabase.from("oura_tokens").delete().eq("user_id", userId);

    if (error) {
      throw new Error(`Failed to disconnect Oura: ${error.message}`);
    }
  }

  // Find an internal user ID from an Oura user ID
  static async getInternalUserId(ouraUserId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from("oura_tokens")
      .select("user_id")
      .eq("oura_user_id", ouraUserId)
      .single();

    if (error) {
      // Log if it's not the "no rows" error, which is expected if no user is found.
      if (error.code !== "PGRST116") {
        console.error(`Error fetching internal user for Oura ID ${ouraUserId}:`, error);
      }
      return null;
    }
    return data?.user_id || null;
  }

  // Sync a single day of activity for a specific user, typically triggered by a webhook
  static async syncUserActivityForDay(internalUserId: string, day: string): Promise<void> {
    try {
      console.log(`Webhook: Syncing data for user ${internalUserId} for day ${day}...`);
      const accessToken = await this.getValidAccessToken(internalUserId);
      const activityData = await this.getDailyActivity(accessToken, day, day);

      if (activityData.data && activityData.data.length > 0) {
        const activity = activityData.data[0];
        const { error: upsertError } = await supabase.from("oura_activities").upsert(
          {
            user_id: internalUserId,
            date: activity.day,
            steps: activity.steps,
            calories_active: activity.active_calories,
            calories_total: activity.total_calories,
            distance: activity.equivalent_walking_distance,
          },
          { onConflict: "user_id, date" }
        );

        if (upsertError) {
          throw new Error(`Failed to upsert webhook activity data: ${upsertError.message}`);
        }
        console.log(
          `Webhook: Sync successful for user ${internalUserId} on ${activity.day}: ${JSON.stringify(
            activity
          )}`
        );
      } else {
        console.log(`Webhook: No new activity data found for user ${internalUserId} on ${day}.`);
      }
    } catch (error) {
      console.error(`Webhook: Failed to sync data for user ${internalUserId}:`, error);
      // We don't re-throw here to prevent a single user's failure from stopping a potential loop.
    }
  }
}

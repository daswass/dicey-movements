import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import { createClient } from "@supabase/supabase-js";
import { OuraService } from "./ouraService";

// Load environment variables
dotenv.config();

// Debug: Check if environment variables are loaded
console.log("🔍 Main server environment check:");
console.log("OURA_CLIENT_ID from process.env:", process.env.OURA_CLIENT_ID ? "SET" : "NOT SET");
console.log("OURA_CLIENT_ID value:", process.env.OURA_CLIENT_ID);
console.log("SUPABASE_URL from process.env:", process.env.SUPABASE_URL ? "SET" : "NOT SET");
console.log("SUPABASE_URL value:", process.env.SUPABASE_URL);
console.log(
  "SUPABASE_ANON_KEY from process.env:",
  process.env.SUPABASE_ANON_KEY ? "SET" : "NOT SET"
);
console.log(
  "SUPABASE_SERVICE_ROLE_KEY from process.env:",
  process.env.SUPABASE_SERVICE_ROLE_KEY ? "SET" : "NOT SET"
);

// Initialize Express app
const app = express();

// Initialize Supabase client with fallbacks for testing
const supabaseUrl = process.env.SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseKey = process.env.SUPABASE_ANON_KEY || "placeholder-key";

if (!supabaseUrl || !supabaseKey) {
  console.warn("Warning: Missing Supabase configuration. Some features may not work properly.");
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: "Too many requests from this IP, please try again later.",
});

app.use(limiter);

// Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Backend server is running!" });
});

// Oura Integration Routes
app.get("/api/oura/auth-url", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const state = Buffer.from(JSON.stringify({ userId })).toString("base64");
    const authUrl = OuraService.getAuthorizationUrl(state);

    res.json({ authUrl });
  } catch (error) {
    console.error("Error generating auth URL:", error);
    res.status(500).json({ error: "Failed to generate authorization URL" });
  }
});

app.get("/api/oura/callback", async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.status(400).json({ error: "Missing code or state parameter" });
    }

    // Decode state to get userId
    const stateData = JSON.parse(Buffer.from(state as string, "base64").toString());
    const { userId } = stateData;

    // Exchange code for tokens
    const tokenData = await OuraService.exchangeCodeForToken(code as string);

    // Get Oura user ID
    const personalInfo = await OuraService.getPersonalInfo(tokenData.access_token);
    const ouraUserId = personalInfo.id;

    // Subscribe to all relevant webhooks for this user
    const subscriptionIds = await OuraService.subscribeToAllWebhooks(tokenData.access_token);

    // Save tokens and subscription IDs to database
    await OuraService.saveTokens(userId, tokenData, ouraUserId, subscriptionIds);

    // Initial sync of activity data
    await OuraService.syncUserActivity(userId, 7);

    // Redirect to frontend with success status
    const frontendUrl = process.env.FRONTEND_URL || "https://dicey-movements.netlify.app";
    res.redirect(`${frontendUrl}?oura=success`);
  } catch (error) {
    console.error("Error in Oura callback:", error);
    // Redirect to frontend with error status
    const frontendUrl = process.env.FRONTEND_URL || "https://dicey-movements.netlify.app";
    res.redirect(
      `${frontendUrl}?oura=error&message=${encodeURIComponent(
        error instanceof Error ? error.message : String(error)
      )}`
    );
  }
});

app.get("/api/oura/status/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const tokens = await OuraService.getTokens(userId);

    res.json({
      connected: !!tokens,
      hasValidToken: tokens ? !OuraService.isTokenExpired(tokens.expires_at) : false,
    });
  } catch (error) {
    console.error("Error checking Oura status:", error);
    res.status(500).json({ error: "Failed to check Oura status" });
  }
});

app.post("/api/oura/sync/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { days = 7 } = req.body;

    await OuraService.syncUserActivity(userId, days);

    res.json({ success: true, message: "Activity data synced successfully" });
  } catch (error) {
    console.error("Error syncing Oura activity:", error);
    res.status(500).json({ error: "Failed to sync activity data" });
  }
});

app.delete("/api/oura/disconnect/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    await OuraService.disconnectUser(userId);

    res.json({ success: true, message: "Oura integration disconnected" });
  } catch (error) {
    console.error("Error disconnecting Oura:", error);
    res.status(500).json({ error: "Failed to disconnect Oura integration" });
  }
});

// Oura Webhook Endpoint
// Handles the one-time verification GET request from Oura
app.get("/api/oura/webhook", (req, res) => {
  const verificationToken = req.query.verification_token;
  if (verificationToken) {
    console.log(
      `Oura webhook verification request received. Responding with token: ${verificationToken}`
    );
    res.send(verificationToken as string);
  } else {
    console.warn("Received a GET request to webhook URL without a verification_token.");
    res.status(400).send("Missing verification_token");
  }
});

// Handles incoming data events from Oura
app.post("/api/oura/webhook", (req, res) => {
  // Immediately respond to Oura with a 200 OK to acknowledge receipt.
  res.status(200).send("Event received");

  // Process the event asynchronously to avoid holding up the request.
  (async () => {
    try {
      const events = req.body.events;
      if (!events || !Array.isArray(events)) {
        console.warn("Webhook received with invalid event format:", req.body);
        return;
      }

      console.log(`Received ${events.length} events from Oura webhook.`);

      for (const event of events) {
        if (event.type === "new_daily_activity" && event.oura_user_id && event.day) {
          console.log(`Processing 'new_daily_activity' for oura_user_id: ${event.oura_user_id}`);

          const internalUserId = await OuraService.getInternalUserId(event.oura_user_id);

          if (internalUserId) {
            await OuraService.syncUserActivityForDay(internalUserId, event.day);
          } else {
            console.warn(
              `Webhook event for Oura user ${event.oura_user_id} couldn't be mapped to an internal user.`
            );
          }
        }
      }
    } catch (error) {
      console.error("Error processing Oura webhook:", error);
    }
  })();
});

// Leaderboard routes
app.get("/api/leaderboard/:location", async (req, res) => {
  try {
    const { location } = req.params;
    const { data, error } = await supabase
      .from("leaderboard")
      .select("*")
      .eq("location", location)
      .order("score", { ascending: false })
      .limit(10);

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

// User profile routes
app.get("/api/profile/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// Friend activity routes
app.get("/api/friends/activity/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { data, error } = await supabase
      .from("friend_activities")
      .select("*")
      .eq("user_id", userId)
      .order("timestamp", { ascending: false })
      .limit(20);

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error("Error fetching friend activities:", error);
    res.status(500).json({ error: "Failed to fetch friend activities" });
  }
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔗 Oura endpoints available at http://localhost:${PORT}/api/oura/*`);
});

import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import rateLimit from "express-rate-limit";
import { OuraService } from "./ouraService";
import { pushNotificationService } from "./pushNotificationService";
import { supabase } from "./supabaseClient";

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

// Initialize environment variables
const ouraWebhookVerificationToken =
  process.env.OURA_WEBHOOK_VERIFICATION_TOKEN || "placeholder-verification-token";

// Middleware
app.use(
  cors({
    origin: [
      "https://dicey-movements.netlify.app",
      "http://localhost:5173",
      "http://localhost:3000",
      "http://localhost:4173",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
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

    // Save tokens to database
    await OuraService.saveTokens(userId, tokenData, ouraUserId);

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
  const { verification_token, challenge } = req.query;

  if (verification_token === ouraWebhookVerificationToken) {
    console.log(`Oura webhook verification request received. Responding with challenge.`);
    res.json({ challenge });
  } else {
    console.warn("Invalid verification token");
    res.status(401).send("Invalid verification token");
  }
});

// Handles incoming data events from Oura
app.post("/api/oura/webhook", (req, res) => {
  // Immediately respond to Oura with a 200 OK to acknowledge receipt.
  res.status(200).send("Event received");

  // Process the event asynchronously to avoid holding up the request.
  (async () => {
    try {
      const { event_type, data_type, object_id, user_id } = req.body;

      console.log(
        `Received ${data_type} ${event_type} event for user ${user_id} from Oura webhook.`
      );

      if (user_id) {
        const internalUserId = await OuraService.getInternalUserId(user_id);
        if (internalUserId) {
          const date = new Date().toISOString().split("T")[0];
          await OuraService.syncUserActivityForDay(internalUserId, date);
        } else {
          console.warn(
            `Webhook event for Oura user ${user_id} couldn't be mapped to an internal user.`
          );
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

// Push Notification Routes
app.get("/api/push/vapid-public-key", (req, res) => {
  try {
    const publicKey = pushNotificationService.getVapidPublicKey();
    res.json({ publicKey });
  } catch (error) {
    console.error("Error getting VAPID public key:", error);
    res.status(500).json({ error: "Failed to get VAPID public key" });
  }
});

app.post("/api/push/subscribe", async (req, res) => {
  try {
    const { userId, subscription } = req.body;

    if (!userId || !subscription) {
      return res.status(400).json({ error: "userId and subscription are required" });
    }

    const success = await pushNotificationService.saveSubscription(userId, subscription);

    if (success) {
      res.json({ success: true, message: "Push subscription saved" });
    } else {
      res.status(500).json({ error: "Failed to save push subscription" });
    }
  } catch (error) {
    console.error("Error saving push subscription:", error);
    res.status(500).json({ error: "Failed to save push subscription" });
  }
});

app.delete("/api/push/unsubscribe", async (req, res) => {
  try {
    const { userId, endpoint } = req.body;

    if (!userId || !endpoint) {
      return res.status(400).json({ error: "userId and endpoint are required" });
    }

    const success = await pushNotificationService.removeSubscription(userId, endpoint);

    if (success) {
      res.json({ success: true, message: "Push subscription removed" });
    } else {
      res.status(500).json({ error: "Failed to remove push subscription" });
    }
  } catch (error) {
    console.error("Error removing push subscription:", error);
    res.status(500).json({ error: "Failed to remove push subscription" });
  }
});

app.post("/api/push/send", async (req, res) => {
  try {
    const { userId, payload } = req.body;

    if (!userId || !payload) {
      return res.status(400).json({ error: "userId and payload are required" });
    }

    let success = false;

    // Handle different notification types
    if (payload.type === "achievement") {
      success = await pushNotificationService.sendAchievementNotification(
        userId,
        payload.achievementName
      );
    } else if (payload.type === "friend_activity") {
      success = await pushNotificationService.sendFriendActivityNotification(
        userId,
        payload.friendName,
        payload.activity
      );
    } else if (payload.type === "friend_request") {
      success = await pushNotificationService.sendFriendRequestNotification(
        userId,
        payload.friendName
      );
    } else {
      // Default to generic notification
      success = await pushNotificationService.sendNotification(userId, payload);
    }

    if (success) {
      res.json({ success: true, message: "Notification sent" });
    } else {
      res.status(500).json({ error: "Failed to send notification" });
    }
  } catch (error) {
    console.error("Error sending notification:", error);
    res.status(500).json({ error: "Failed to send notification" });
  }
});

app.post("/api/workout/complete", async (req, res) => {
  try {
    const { userId, exercise, reps, multipliers } = req.body;

    if (!userId || !exercise || !reps) {
      return res.status(400).json({ error: "userId, exercise, and reps are required" });
    }

    // Get user's profile to check notification settings
    const { data: userProfile, error: profileError } = await supabase
      .from("profiles")
      .select("notification_settings, first_name, last_name")
      .eq("id", userId)
      .single();

    if (profileError) {
      console.error("Error fetching user profile:", profileError);
      return res.status(500).json({ error: "Failed to fetch user profile" });
    }

    const userName = `${userProfile.first_name} ${userProfile.last_name}`;
    const activity = `${exercise} (${reps} reps)`;

    // Get user's friends
    const { data: friends, error: friendsError } = await supabase
      .from("friends")
      .select("user_id")
      .eq("friend_id", userId)
      .eq("status", "accepted");

    if (friendsError) {
      console.error("Error fetching friends:", friendsError);
      return res.status(500).json({ error: "Failed to fetch friends" });
    }

    // Get notification settings for all friends to filter those with friend_activity enabled
    const friendIds = friends.map((friend) => friend.user_id);
    const { data: friendProfiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, notification_settings")
      .in("id", friendIds);

    if (profilesError) {
      console.error("Error fetching friend profiles:", profilesError);
      return res.status(500).json({ error: "Failed to fetch friend profiles" });
    }

    // Filter friends who have friend_activity notifications enabled
    const friendsWithNotificationsEnabled = friendProfiles.filter((profile) => {
      const settings = profile.notification_settings || {};
      return settings.friend_activity === true;
    });

    console.log(
      `Found ${friendsWithNotificationsEnabled.length} friends with friend activity notifications enabled out of ${friends.length} total friends`
    );

    // Return early if no friends have notifications enabled
    if (friendsWithNotificationsEnabled.length === 0) {
      console.log(
        "No friends have friend activity notifications enabled, skipping notification sending"
      );
      return res.json({
        success: true,
        message:
          "Workout completed (no notifications sent - no friends have notifications enabled)",
        notifications: {
          sent: 0,
          failed: 0,
        },
      });
    }

    // Send friend activity notifications to friends with notifications enabled
    const notificationPromises = friendsWithNotificationsEnabled.map(async (friend) => {
      try {
        const success = await pushNotificationService.sendFriendActivityNotification(
          friend.id,
          userName,
          activity
        );
        return { userId: friend.id, success };
      } catch (error) {
        console.error(`Error sending notification to friend ${friend.id}:`, error);
        return { userId: friend.id, success: false };
      }
    });

    const results = await Promise.allSettled(notificationPromises);
    const successful = results.filter(
      (result) => result.status === "fulfilled" && result.value.success
    ).length;
    const failed = results.length - successful;

    console.log(`Friend activity notifications sent: ${successful} successful, ${failed} failed`);

    res.json({
      success: true,
      message: "Workout completed and notifications sent",
      notifications: {
        sent: successful,
        failed: failed,
      },
    });
  } catch (error) {
    console.error("Error completing workout:", error);
    res.status(500).json({ error: "Failed to complete workout" });
  }
});

app.put("/api/notifications/settings/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { setting, enabled } = req.body;

    if (!userId || setting === undefined || enabled === undefined) {
      return res.status(400).json({ error: "userId, setting, and enabled are required" });
    }

    // Validate setting name
    const validSettings = ["timer_expired", "achievements", "friend_activity", "friend_requests"];
    if (!validSettings.includes(setting)) {
      return res.status(400).json({ error: "Invalid setting name" });
    }

    // First get current settings
    console.log("Fetching notification settings for user:", userId);
    const { data: currentData, error: fetchError } = await supabase
      .from("profiles")
      .select("notification_settings")
      .eq("id", userId)
      .single();

    if (fetchError) {
      console.error("Error fetching current notification settings:", fetchError);
      console.error("Error details:", JSON.stringify(fetchError, null, 2));
      return res.status(500).json({ error: "Failed to fetch current notification settings" });
    }

    console.log("Current notification settings:", currentData);

    // Update the specific setting
    const currentSettings = currentData?.notification_settings || {};
    const updatedSettings = {
      ...currentSettings,
      [setting]: enabled,
    };

    const { data, error } = await supabase
      .from("profiles")
      .update({
        notification_settings: updatedSettings,
      })
      .eq("id", userId)
      .select("notification_settings")
      .single();

    if (error) {
      console.error("Error updating notification settings:", error);
      return res.status(500).json({ error: "Failed to update notification settings" });
    }

    res.json({
      success: true,
      message: "Notification setting updated",
      settings: data.notification_settings,
    });
  } catch (error) {
    console.error("Error updating notification settings:", error);
    res.status(500).json({ error: "Failed to update notification settings" });
  }
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔗 Oura endpoints available at http://localhost:${PORT}/api/oura/*`);
});

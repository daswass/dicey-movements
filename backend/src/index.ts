import cors from "cors";
import dotenv from "dotenv";
import express, { Request } from "express";
import rateLimit from "express-rate-limit";
import {
  requireAuth,
  requireSelfBody,
  requireSelfFromUserIdField,
  requireSelfParam,
} from "./authMiddleware";
import { createOuraOAuthState, verifyOuraOAuthState } from "./oauthState";
import { OuraService } from "./ouraService";
import { logOuraError } from "./ouraError";
import {
  isValidOuraWebhookSignature,
  OuraWebhookReplayProtector,
  parseOuraWebhookEvent,
} from "./ouraWebhook";
import { pushNotificationService } from "./pushNotificationService";
import { supabase } from "./supabaseClient";
import {
  recordWorkoutCompletion,
  runWorkoutCompletionEffects,
  validateWorkoutCompletion,
} from "./workoutCompletionService";
import { isValidOuraWebhookToken } from "./webhookAuth";

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Trust proxy for rate limiting behind load balancers/proxies
app.set("trust proxy", 1);

// Initialize environment variables
const ouraWebhookVerificationToken = process.env.OURA_WEBHOOK_VERIFICATION_TOKEN;
const ouraWebhookReplayProtector = new OuraWebhookReplayProtector();

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
app.use(
  express.json({
    verify: (req, _res, buffer) => {
      if (req.url?.split("?")[0] === "/api/oura/webhook") {
        (req as Request).rawBody = Buffer.from(buffer);
      }
    },
  })
);

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
app.get("/api/oura/auth-url", requireAuth, async (req, res) => {
  try {
    const userId = req.authUser!.id;
    const state = createOuraOAuthState(userId);
    const authUrl = OuraService.getAuthorizationUrl(state);

    res.json({ authUrl });
  } catch (error) {
    logOuraError("Error generating Oura auth URL", error);
    res.status(500).json({ error: "Failed to generate authorization URL" });
  }
});

app.get("/api/oura/callback", async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.status(400).json({ error: "Missing code or state parameter" });
    }

    const { userId } = verifyOuraOAuthState(state as string);

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
    logOuraError("Error in Oura callback", error);
    // Redirect to frontend with error status
    const frontendUrl = process.env.FRONTEND_URL || "https://dicey-movements.netlify.app";
    res.redirect(
      `${frontendUrl}?oura=error&message=${encodeURIComponent("Unable to complete Oura connection")}`
    );
  }
});

app.get("/api/oura/status/:userId", requireAuth, requireSelfParam("userId"), async (req, res) => {
  try {
    const { userId } = req.params;
    const tokens = await OuraService.getTokens(userId);

    res.json({
      connected: !!tokens,
      hasValidToken: tokens ? !OuraService.isTokenExpired(tokens.expires_at) : false,
    });
  } catch (error) {
    logOuraError("Error checking Oura status", error);
    res.status(500).json({ error: "Failed to check Oura status" });
  }
});

app.post("/api/oura/sync/:userId", requireAuth, requireSelfParam("userId"), async (req, res) => {
  try {
    const { userId } = req.params;
    const { days = 7 } = req.body;

    await OuraService.syncUserActivity(userId, days);

    res.json({ success: true, message: "Activity data synced successfully" });
  } catch (error) {
    logOuraError("Error syncing Oura activity", error);
    res.status(500).json({ error: "Failed to sync activity data" });
  }
});

app.delete("/api/oura/disconnect/:userId", requireAuth, requireSelfParam("userId"), async (req, res) => {
  try {
    const { userId } = req.params;

    await OuraService.disconnectUser(userId);

    res.json({ success: true, message: "Oura integration disconnected" });
  } catch (error) {
    logOuraError("Error disconnecting Oura", error);
    res.status(500).json({ error: "Failed to disconnect Oura integration" });
  }
});

// Oura Webhook Endpoint
// Handles the one-time verification GET request from Oura
app.get("/api/oura/webhook", (req, res) => {
  const { verification_token, challenge } = req.query;

  if (isValidOuraWebhookToken(verification_token, ouraWebhookVerificationToken)) {
    console.log(`Oura webhook verification request received. Responding with challenge.`);
    res.json({ challenge });
  } else {
    console.warn("Invalid verification token");
    res.status(401).send("Invalid verification token");
  }
});

// Handles incoming data events from Oura
app.post("/api/oura/webhook", (req, res) => {
  if (
    !isValidOuraWebhookSignature(
      req.rawBody,
      req.headers["x-oura-signature"],
      process.env.OURA_CLIENT_SECRET
    )
  ) {
    console.warn("Rejected Oura webhook with invalid signature");
    return res.status(401).send("Invalid webhook signature");
  }

  const event = parseOuraWebhookEvent(req.body);
  if (!event) {
    console.warn("Rejected Oura webhook with invalid event schema");
    return res.status(400).send("Invalid webhook event");
  }

  if (ouraWebhookReplayProtector.isReplay(event)) {
    console.warn("Ignored replayed Oura webhook event");
    return res.status(200).send("Duplicate event ignored");
  }

  // Acknowledge only after authenticity, schema, and replay checks pass.
  res.status(200).send("Event received");

  // Process the event asynchronously to avoid holding up the request.
  (async () => {
    try {
      const { event_type, data_type, object_id, user_id } = event;

      console.log(
        `Received ${data_type} ${event_type} event ${object_id} for user ${user_id} from Oura webhook.`
      );

      if (user_id) {
        const internalUserId = await OuraService.getInternalUserId(user_id);
        if (internalUserId) {
          const date = new Date(event.event_datetime).toISOString().split("T")[0];
          await OuraService.syncUserActivityForDay(internalUserId, date);
        } else {
          console.warn(
            `Webhook event for Oura user ${user_id} couldn't be mapped to an internal user.`
          );
        }
      }
    } catch (error) {
      logOuraError("Error processing Oura webhook", error);
    }
  })();
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

app.post("/api/push/subscribe", requireAuth, requireSelfBody("userId"), async (req, res) => {
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

app.delete("/api/push/unsubscribe", requireAuth, requireSelfBody("userId"), async (req, res) => {
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

app.put("/api/push/activity", requireAuth, requireSelfBody("userId"), async (req, res) => {
  try {
    const { userId, deviceId } = req.body;

    if (!userId || !deviceId) {
      return res.status(400).json({ error: "userId and deviceId are required" });
    }

    const success = await pushNotificationService.updateSubscriptionActivity(userId, deviceId);

    if (success) {
      res.json({ success: true, message: "Subscription activity updated" });
    } else {
      res.status(500).json({ error: "Failed to update subscription activity" });
    }
  } catch (error) {
    console.error("Error updating subscription activity:", error);
    res.status(500).json({ error: "Failed to update subscription activity" });
  }
});

app.post("/api/push/send", requireAuth, requireSelfBody("userId"), async (req, res) => {
  try {
    const { userId, payload } = req.body;

    if (!userId || !payload || typeof payload !== "object") {
      return res.status(400).json({ error: "userId and payload are required" });
    }

    let success = false;

    // Clients can invoke only narrow self-service intents; server owns all notification content.
    if (payload.type === "clear_notifications") {
      // Send a silent notification that will clear existing notifications by tag
      const clearPayload = {
        title: "", // Empty title for silent notification
        body: "", // Empty body for silent notification
        icon: "/favicon.svg",
        badge: "/favicon.svg",
        tag: typeof payload.clearTag === "string" ? payload.clearTag.slice(0, 100) : undefined,
        silent: true, // Standard Web Push Protocol flag for silent notifications
        data: {
          type: "clear_notifications",
          clearTag:
            typeof payload.clearTag === "string" ? payload.clearTag.slice(0, 100) : undefined,
        },
      };
      success = await pushNotificationService.sendNotification(userId, clearPayload);
    } else if (payload.type === "timer_expired") {
      success = await pushNotificationService.sendTimerExpiredNotification(userId);
    } else {
      return res.status(400).json({ error: "Unsupported notification type" });
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

app.post("/api/workout/complete", requireAuth, async (req, res) => {
  try {
    validateWorkoutCompletion(req.body);
    const userId = req.authUser!.id;
    const completion = await recordWorkoutCompletion(supabase, userId, req.body);

    // The activity and its one-shot effect record are committed before this response is sent.
    // Effects run out-of-band so a push-provider failure cannot make the client retry an
    // already durable workout.
    res.status(completion.created ? 201 : 200).json({
      success: true,
      created: completion.created,
      activity: completion.activity,
    });

    if (completion.created) {
      void runWorkoutCompletionEffects(supabase, pushNotificationService, userId, req.body).catch(
        (error) => console.error("Error running workout completion effects:", error)
      );
    }
  } catch (error) {
    if (error instanceof Error && /must be|is required|between 1 and 6|ISO date/.test(error.message)) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Error completing workout:", error);
    res.status(500).json({ error: "Failed to complete workout" });
  }
});

app.post(
  "/api/high-five/send",
  requireAuth,
  requireSelfFromUserIdField("fromUserId"),
  async (req, res) => {
  try {
    const { fromUserId, toUserId, activity } = req.body;

    if (!fromUserId || !toUserId) {
      return res.status(400).json({ error: "fromUserId and toUserId are required" });
    }

    // Get sender's profile
    const { data: senderProfile, error: senderError } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", fromUserId)
      .single();

    if (senderError) {
      console.error("Error fetching sender profile:", senderError);
      return res.status(500).json({ error: "Failed to fetch sender profile" });
    }

    const senderName = `${senderProfile.first_name} ${senderProfile.last_name}`;

    // Verify they are friends
    if (fromUserId !== toUserId) {
      const { data: friendship, error: friendshipError } = await supabase
        .from("friends")
        .select("id")
        .or(
          `and(user_id.eq.${fromUserId},friend_id.eq.${toUserId}),and(user_id.eq.${toUserId},friend_id.eq.${fromUserId})`
        )
        .eq("status", "accepted")
        .single();

      if (friendshipError || !friendship) {
        return res.status(403).json({ error: "Users must be friends to send high fives" });
      }
    }

    // Send high five notification
    const success = await pushNotificationService.sendHighFiveNotification(
      toUserId,
      senderName,
      activity
    );

    if (success) {
      res.json({
        success: true,
        message: "High five sent successfully",
        senderName,
      });
    } else {
      res.status(500).json({ error: "Failed to send high five notification" });
    }
  } catch (error) {
    console.error("Error sending high five:", error);
    res.status(500).json({ error: "Failed to send high five" });
  }
  }
);

app.put(
  "/api/notifications/settings/:userId",
  requireAuth,
  requireSelfParam("userId"),
  async (req, res) => {
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
  }
);

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔗 Oura endpoints available at http://localhost:${PORT}/api/oura/*`);
});

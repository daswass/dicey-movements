import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import { createClient } from "@supabase/supabase-js";

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase configuration");
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
  res.json({ status: "ok" });
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
  console.log(`Server running on port ${PORT}`);
});

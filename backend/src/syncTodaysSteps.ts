import { OuraService } from "./ouraService";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function syncTodaysSteps() {
  console.log("Starting daily step sync for all users...");

  // 1. Get all users with valid oura_tokens
  const { data: users, error: usersError } = await supabase
    .from("oura_tokens")
    .select("user_id, refresh_token, expires_at");

  if (usersError) {
    console.error("Error fetching users:", usersError);
    return;
  }

  if (!users || users.length === 0) {
    console.log("No users with Oura tokens found. Exiting sync.");
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  let successCount = 0;
  let errorCount = 0;

  console.log(`Found ${users.length} users to sync.`);

  // 2. Iterate and sync for each user
  for (const user of users) {
    try {
      const accessToken = await OuraService.getValidAccessToken(user.user_id);
      const activityData = await OuraService.getDailyActivity(accessToken, today, today);

      if (activityData.data && activityData.data.length > 0) {
        const activity = activityData.data[0];
        const { error: upsertError } = await supabase.from("oura_activities").upsert(
          {
            user_id: user.user_id,
            date: activity.day,
            steps: activity.steps,
            calories_active: activity.active_calories,
            calories_total: activity.total_calories,
            distance: activity.equivalent_walking_distance,
          },
          { onConflict: "user_id, date" }
        );

        if (upsertError) {
          throw new Error(`Failed to upsert activity data: ${upsertError.message}`);
        }
        console.log(`Successfully synced steps for user ${user.user_id} for date ${activity.day}.`);
        successCount++;
      } else {
        console.log(`No activity data for today for user ${user.user_id}.`);
      }
    } catch (error) {
      console.error(`Failed to sync data for user ${user.user_id}:`, error);
      errorCount++;
    }
  }
  console.log("--- Sync Complete ---");
  console.log(`Successfully synced: ${successCount}`);
  console.log(`Failed to sync: ${errorCount}`);
}

syncTodaysSteps();

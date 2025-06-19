import { createClient } from "@supabase/supabase-js";
import { OuraService } from "./ouraService";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function syncAllOuraData() {
  console.log("Starting Oura data sync for all users...");

  try {
    // Get all users with Oura integration
    const { data: ouraUsers, error } = await supabase.from("oura_tokens").select("user_id");

    if (error) {
      console.error("Error fetching Oura users:", error);
      return;
    }

    if (!ouraUsers || ouraUsers.length === 0) {
      console.log("No users with Oura integration found.");
      return;
    }

    console.log(`Found ${ouraUsers.length} users with Oura integration.`);

    // Sync data for each user
    for (const user of ouraUsers) {
      try {
        console.log(`Syncing data for user: ${user.user_id}`);
        await OuraService.syncUserActivity(user.user_id, 7);
        console.log(`Successfully synced data for user: ${user.user_id}`);
      } catch (error) {
        console.error(`Failed to sync data for user ${user.user_id}:`, error);
      }
    }

    console.log("Oura data sync completed.");
  } catch (error) {
    console.error("Error during Oura data sync:", error);
  }
}

// Run the sync if this script is executed directly
if (require.main === module) {
  syncAllOuraData()
    .then(() => {
      console.log("Sync script completed.");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Sync script failed:", error);
      process.exit(1);
    });
}

export { syncAllOuraData };

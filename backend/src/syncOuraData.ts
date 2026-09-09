import { createClient } from "@supabase/supabase-js";
import { OuraService } from "./ouraService";
import dotenv from "dotenv";
import { classifyOuraError, logOuraError, requiresOuraReconnect } from "./ouraError";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function syncAllOuraData() {
  console.log("Starting Oura data sync for all users...");

  // Get all users with Oura integration
  const { data: ouraUsers, error } = await supabase.from("oura_tokens").select("user_id");

  if (error) {
    throw new Error(`Error fetching Oura users: ${error.message}`);
  }

  if (!ouraUsers || ouraUsers.length === 0) {
    console.log("No users with Oura integration found.");
    return;
  }

  console.log(`Found ${ouraUsers.length} users with Oura integration.`);
  let errorCount = 0;

  // Sync data for each user
  for (const user of ouraUsers) {
    try {
      console.log(`Syncing data for user: ${user.user_id}`);
      await OuraService.syncUserActivity(user.user_id, 7);
      console.log(`Successfully synced data for user: ${user.user_id}`);
    } catch (error) {
      // Keep the scheduled job actionable without logging Axios request bodies,
      // authorization headers, or OAuth credentials.
      logOuraError(`Scheduled Oura sync failed for user ${user.user_id}`, error);

      if (requiresOuraReconnect(error)) {
        try {
          await OuraService.disconnectUser(user.user_id);
          console.log(
            `Disconnected Oura connection for user ${user.user_id} [reauthentication_required]`
          );
          continue;
        } catch (disconnectError) {
          logOuraError(`Failed to disconnect Oura for user ${user.user_id}`, disconnectError);
        }
      }

      errorCount++;
    }
  }

  console.log("Oura data sync completed.");

  if (errorCount > 0) {
    throw new Error(`${errorCount} Oura user sync(s) failed`);
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
      console.error(`Oura scheduled sync failed [${classifyOuraError(error)}]`);
      process.exit(1);
    });
}

export { syncAllOuraData };

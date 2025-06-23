import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function updateAllUserStreaks() {
  console.log("Starting streak update for all users...");

  try {
    // Get all users
    const { data: users, error: usersError } = await supabase.from("profiles").select("id");

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    if (!users || users.length === 0) {
      console.log("No users found.");
      return;
    }

    console.log(`Found ${users.length} users. Updating streaks...`);

    let successCount = 0;
    let errorCount = 0;

    for (const user of users) {
      try {
        // Call the streak update function for each user
        const { error } = await supabase.rpc("update_user_streak", {
          user_id_param: user.id,
        });

        if (error) {
          console.error(`Failed to update streak for user ${user.id}:`, error);
          errorCount++;
        } else {
          console.log(`Successfully updated streak for user ${user.id}`);
          successCount++;
        }
      } catch (error) {
        console.error(`Error updating streak for user ${user.id}:`, error);
        errorCount++;
      }
    }

    console.log("--- Streak Update Complete ---");
    console.log(`Successfully updated: ${successCount} users`);
    console.log(`Failed to update: ${errorCount} users`);
  } catch (error) {
    console.error("Failed to update streaks:", error);
  }
}

// Run the function if this script is executed directly
if (require.main === module) {
  updateAllUserStreaks()
    .then(() => {
      console.log("Streak update completed.");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Streak update failed:", error);
      process.exit(1);
    });
}

export { updateAllUserStreaks };

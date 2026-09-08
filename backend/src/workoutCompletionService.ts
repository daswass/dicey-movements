import type { SupabaseClient } from "@supabase/supabase-js";

export interface WorkoutCompletionInput {
  activityId: string;
  timestamp: string;
  exerciseId: number;
  exerciseName: string;
  reps: number;
  multiplier: number;
  diceRoll?: { exerciseDie: number; repsDie: number } | null;
  zoneId?: string | null;
}

export interface WorkoutCompletionRecord {
  activity: WorkoutCompletionInput & { user_id: string };
  created: boolean;
}

export interface WorkoutCompletionPushService {
  sendAchievementNotification(userId: string, achievementName: string): Promise<boolean>;
  sendFriendActivityNotification(
    userId: string,
    friendName: string,
    activity: string,
    friendId?: string
  ): Promise<boolean>;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const completionAchievements = [
  { id: "first_streak", name: "Getting Started", type: "streak", value: 3 },
  { id: "weekday_warrior", name: "Weekday Warrior", type: "streak", value: 5 },
  { id: "week_warrior", name: "Week Warrior", type: "streak", value: 7 },
  { id: "month_master", name: "Month Master", type: "streak", value: 30 },
  { id: "first_workout", name: "First Steps", type: "sets", value: 1 },
  { id: "century_club", name: "Century Club", type: "single", value: 100 },
  { id: "pushup_pro", name: "Push-up Pro", type: "exercise", exerciseName: "Pushup", value: 50 },
  { id: "senor_squat", name: "Señor Squat", type: "exercise", exerciseName: "Squat", value: 100 },
  { id: "burpee_slurpee", name: "Burpee Slurpee", type: "exercise", exerciseName: "Burpee", value: 75 },
  { id: "situp_specialist", name: "Sit-up Specialist", type: "exercise", exerciseName: "Situp", value: 200 },
  { id: "arnolds_angels", name: "Arnold's Angels", type: "exercise", exerciseName: "Arnold Press", value: 400 },
  { id: "active_lifestyle", name: "Active Lifestyle", type: "days", value: 10 },
  { id: "lucky_roller", name: "Lucky Roller", type: "perfect", value: 5 },
] as const;

type ActivityRow = {
  reps: number;
  exercise_name: string;
  timestamp: string;
  dice_roll: { exerciseDie?: number; repsDie?: number } | null;
};

type ProfileRow = {
  first_name: string;
  last_name: string;
  stats: { streak?: number; achievements?: Array<{ id?: string }> } | null;
};

export function validateWorkoutCompletion(input: unknown): asserts input is WorkoutCompletionInput {
  const value = input as Partial<WorkoutCompletionInput> | null;
  if (!value || typeof value !== "object" || !UUID_PATTERN.test(value.activityId ?? "")) {
    throw new Error("activityId must be a UUID");
  }
  if (typeof value.timestamp !== "string" || Number.isNaN(Date.parse(value.timestamp))) {
    throw new Error("timestamp must be an ISO date");
  }
  if (
    typeof value.exerciseId !== "number" ||
    !Number.isInteger(value.exerciseId) ||
    value.exerciseId < 1 ||
    value.exerciseId > 6
  ) {
    throw new Error("exerciseId must be between 1 and 6");
  }
  if (typeof value.exerciseName !== "string" || !value.exerciseName.trim() || value.exerciseName.length > 100) {
    throw new Error("exerciseName is required");
  }
  if (typeof value.reps !== "number" || !Number.isInteger(value.reps) || value.reps < 1 || value.reps > 10000) {
    throw new Error("reps must be a positive integer");
  }
  if (
    typeof value.multiplier !== "number" ||
    !Number.isInteger(value.multiplier) ||
    value.multiplier < 1 ||
    value.multiplier > 1000
  ) {
    throw new Error("multiplier must be a positive integer");
  }
  if (value.diceRoll && (!Number.isInteger(value.diceRoll.exerciseDie) || !Number.isInteger(value.diceRoll.repsDie))) {
    throw new Error("diceRoll must contain integer dice values");
  }
}

export async function recordWorkoutCompletion(
  db: Pick<SupabaseClient, "rpc">,
  userId: string,
  input: WorkoutCompletionInput
): Promise<WorkoutCompletionRecord> {
  validateWorkoutCompletion(input);
  const { data, error } = await db.rpc("record_workout_completion", {
    p_activity_id: input.activityId,
    p_user_id: userId,
    p_timestamp: input.timestamp,
    p_exercise_id: input.exerciseId,
    p_exercise_name: input.exerciseName.trim(),
    p_reps: input.reps,
    p_multiplier: input.multiplier,
    p_dice_roll: input.diceRoll ?? null,
    p_zone_id: input.zoneId ?? null,
  });

  if (error || !data?.[0]) {
    throw new Error(error?.message || "Failed to record workout activity");
  }

  return data[0] as WorkoutCompletionRecord;
}

async function claimPostCommitEffects(db: Pick<SupabaseClient, "rpc">, activityId: string) {
  const { data, error } = await db.rpc("claim_workout_completion_effects", {
    p_activity_id: activityId,
  });
  if (error) throw new Error(error.message);
  return data === true;
}

async function finishPostCommitEffects(db: Pick<SupabaseClient, "rpc">, activityId: string) {
  const { error } = await db.rpc("finish_workout_completion_effects", {
    p_activity_id: activityId,
  });
  if (error) throw new Error(error.message);
}

async function unlockCompletionAchievements(
  db: SupabaseClient,
  userId: string,
  activity: WorkoutCompletionInput
): Promise<string[]> {
  const [{ data: profile, error: profileError }, { data: activities, error: activitiesError }] = await Promise.all([
    db.from("profiles").select("stats").eq("id", userId).single(),
    db.from("activities").select("reps, exercise_name, timestamp, dice_roll").eq("user_id", userId),
  ]);
  if (profileError || activitiesError || !profile) {
    throw new Error(profileError?.message || activitiesError?.message || "Profile not found");
  }

  const currentAchievements = (profile.stats?.achievements || []) as Array<{ id?: string }>;
  const unlockedIds = new Set(currentAchievements.map((achievement: { id?: string }) => achievement.id));
  const allActivities = (activities || []) as ActivityRow[];
  const exerciseTotals = allActivities.reduce<Record<string, number>>((totals, row) => {
    totals[row.exercise_name] = (totals[row.exercise_name] || 0) + row.reps;
    return totals;
  }, {});
  const activeDays = new Set(allActivities.map((row) => new Date(row.timestamp).toDateString())).size;
  const perfectRolls = allActivities.filter(
    (row) => row.dice_roll?.exerciseDie === 6 && row.dice_roll?.repsDie === 6
  ).length;
  const streak = profile.stats?.streak || 0;

  const newlyUnlocked = completionAchievements.filter((achievement) => {
    if (unlockedIds.has(achievement.id)) return false;
    switch (achievement.type) {
      case "streak": return streak >= achievement.value;
      case "sets": return allActivities.length >= achievement.value;
      case "single": return activity.reps >= achievement.value;
      case "exercise": return (exerciseTotals[achievement.exerciseName] || 0) >= achievement.value;
      case "days": return activeDays >= achievement.value;
      case "perfect": return perfectRolls >= achievement.value;
    }
  });

  if (newlyUnlocked.length === 0) return [];

  const achievements = [
    ...currentAchievements,
    ...newlyUnlocked.map((achievement) => ({
      id: achievement.id,
      name: achievement.name,
      unlockedAt: new Date().toISOString(),
    })),
  ];
  const { error } = await db
    .from("profiles")
    .update({ stats: { ...profile.stats, achievements } })
    .eq("id", userId);
  if (error) throw new Error(error.message);
  return newlyUnlocked.map((achievement) => achievement.name);
}

async function notifyFriends(
  db: SupabaseClient,
  push: WorkoutCompletionPushService,
  userId: string,
  activity: WorkoutCompletionInput
) {
  const [{ data: profile, error: profileError }, { data: friends, error: friendsError }] = await Promise.all([
    db.from("profiles").select("first_name, last_name").eq("id", userId).single(),
    db.from("friends").select("user_id").eq("friend_id", userId).eq("status", "accepted"),
  ]);
  if (profileError || friendsError || !profile) {
    throw new Error(profileError?.message || friendsError?.message || "Profile not found");
  }

  const friendIds = (friends || []).map((friend: { user_id: string }) => friend.user_id);
  if (friendIds.length === 0) return;
  const { data: friendProfiles, error } = await db
    .from("profiles")
    .select("id, notification_settings")
    .in("id", friendIds);
  if (error) throw new Error(error.message);

  const senderName = `${(profile as ProfileRow).first_name} ${(profile as ProfileRow).last_name}`.trim();
  const description = `${activity.exerciseName} (${activity.reps} reps)`;
  await Promise.allSettled(
    (friendProfiles || [])
      .filter((friend: { notification_settings?: { friend_activity?: boolean } }) => friend.notification_settings?.friend_activity === true)
      .map((friend: { id: string }) =>
        push.sendFriendActivityNotification(friend.id, senderName, description, userId)
      )
  );
}

/**
 * Effects intentionally run only after record_workout_completion returns: that RPC commits the
 * activity and creates its one-shot effect row in the same transaction. Duplicated client retries
 * cannot claim that row and therefore cannot repeat achievement or push side effects.
 */
export async function runWorkoutCompletionEffects(
  db: SupabaseClient,
  push: WorkoutCompletionPushService,
  userId: string,
  activity: WorkoutCompletionInput
): Promise<void> {
  if (!(await claimPostCommitEffects(db, activity.activityId))) return;

  try {
    const achievementNames = await unlockCompletionAchievements(db, userId, activity);
    await Promise.allSettled([
      notifyFriends(db, push, userId, activity),
      ...achievementNames.map((name) => push.sendAchievementNotification(userId, name)),
    ]);
  } finally {
    await finishPostCommitEffects(db, activity.activityId);
  }
}

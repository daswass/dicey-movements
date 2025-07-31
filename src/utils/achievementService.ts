import { AchievementDefinition, achievements } from "../data/achievements";
import { supabase } from "./supabaseClient";
import { api } from "./api";

export interface AchievementProgress {
  achievementId: string;
  currentValue: number;
  targetValue: number;
  isCompleted: boolean;
  unlockedAt?: Date;
}

export interface UserStats {
  totalReps: number;
  totalSets: number;
  exerciseCounts: { [exerciseId: number]: number };
  daysActive: number;
  perfectRolls: number;
  friendCount: number;
  currentStreak: number;
  longestStreak: number;
  maxStepsInDay: number;
}

export class AchievementService {
  /**
   * Check and unlock achievements for a user
   */
  static async checkAndUnlockAchievements(userId: string): Promise<string[]> {
    const unlockedAchievementIds: string[] = [];

    try {
      // Get current user stats
      const userStats = await this.getUserStats(userId);

      // Get current achievements
      const currentAchievements = await this.getCurrentAchievements(userId);

      // Check each achievement
      for (const achievement of achievements) {
        // Skip if already unlocked
        if (currentAchievements.some((a) => a.id === achievement.id)) {
          continue;
        }

        // Check if achievement criteria is met
        if (await this.checkAchievementCriteria(achievement, userStats)) {
          // Unlock achievement
          await this.unlockAchievement(userId, achievement);
          unlockedAchievementIds.push(achievement.id);
        }
      }

      return unlockedAchievementIds;
    } catch (error) {
      console.error("Error checking achievements:", error);
      return [];
    }
  }

  /**
   * Get comprehensive user stats for achievement checking
   */
  static async getUserStats(userId: string): Promise<UserStats> {
    const stats: UserStats = {
      totalReps: 0,
      totalSets: 0,
      exerciseCounts: {},
      daysActive: 0,
      perfectRolls: 0,
      friendCount: 0,
      currentStreak: 0,
      longestStreak: 0,
      maxStepsInDay: 0,
    };

    try {
      // Get user profile for streak info
      const { data: profile } = await supabase
        .from("profiles")
        .select("stats")
        .eq("id", userId)
        .single();

      if (profile?.stats) {
        stats.currentStreak = profile.stats.streak || 0;
        stats.longestStreak = profile.stats.longestStreak || 0;
      }

      // Get activity data
      const { data: activities } = await supabase
        .from("activities")
        .select("*")
        .eq("user_id", userId);

      if (activities) {
        // Calculate exercise stats
        activities.forEach((activity) => {
          stats.totalReps += activity.reps;
          stats.totalSets += 1;

          // Count by exercise type
          stats.exerciseCounts[activity.exercise_id] =
            (stats.exerciseCounts[activity.exercise_id] || 0) + activity.reps;

          // Check for perfect rolls (6,6)
          if (
            activity.dice_roll &&
            activity.dice_roll.exerciseDie === 6 &&
            activity.dice_roll.repsDie === 6
          ) {
            stats.perfectRolls += 1;
          }
        });

        // Count unique days active
        const uniqueDays = new Set(activities.map((a) => new Date(a.timestamp).toDateString()));
        stats.daysActive = uniqueDays.size;
      }

      // Get friend count
      const { data: friends } = await supabase
        .from("friends")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "accepted");

      stats.friendCount = friends?.length || 0;

      // Get max steps in a day (from Oura data)
      const { data: ouraActivities } = await supabase
        .from("oura_activities")
        .select("steps")
        .eq("user_id", userId);

      if (ouraActivities && ouraActivities.length > 0) {
        stats.maxStepsInDay = Math.max(...ouraActivities.map((a) => a.steps));
      }
    } catch (error) {
      console.error("Error getting user stats:", error);
    }

    return stats;
  }

  /**
   * Check if a specific achievement criteria is met
   */
  static async checkAchievementCriteria(
    achievement: AchievementDefinition,
    userStats: UserStats
  ): Promise<boolean> {
    const { criteria } = achievement;

    switch (criteria.type) {
      case "streak_days":
        return userStats.currentStreak >= criteria.value;

      case "total_reps":
        if (criteria.exerciseId) {
          return (userStats.exerciseCounts[criteria.exerciseId] || 0) >= criteria.value;
        }
        return userStats.totalReps >= criteria.value;

      case "exercise_count":
        return userStats.totalSets >= criteria.value;

      case "friend_count":
        return userStats.friendCount >= criteria.value;

      case "total_steps":
        return userStats.maxStepsInDay >= criteria.value;

      case "single_workout_reps":
        // This needs to be checked when a workout is completed
        return false; // Will be handled separately

      case "days_active":
        return userStats.daysActive >= criteria.value;

      case "perfect_rolls":
        return userStats.perfectRolls >= criteria.value;

      default:
        return false;
    }
  }

  /**
   * Check single workout achievements (called after each workout)
   */
  static async checkSingleWorkoutAchievements(
    userId: string,
    totalReps: number
  ): Promise<string[]> {
    const unlockedAchievementIds: string[] = [];

    try {
      const currentAchievements = await this.getCurrentAchievements(userId);

      // Check century club achievement
      const centuryClub = achievements.find((a) => a.id === "century_club");
      if (
        centuryClub &&
        !currentAchievements.some((a) => a.id === "century_club") &&
        totalReps >= centuryClub.criteria.value
      ) {
        await this.unlockAchievement(userId, centuryClub);
        unlockedAchievementIds.push("century_club");
      }

      return unlockedAchievementIds;
    } catch (error) {
      console.error("Error checking single workout achievements:", error);
      return [];
    }
  }

  /**
   * Unlock an achievement for a user
   */
  static async unlockAchievement(
    userId: string,
    achievement: AchievementDefinition
  ): Promise<void> {
    try {
      // Get current achievements
      const { data: profile } = await supabase
        .from("profiles")
        .select("stats, username")
        .eq("id", userId)
        .single();

      if (!profile) return;

      const currentAchievements = profile.stats?.achievements || [];

      // Add new achievement
      const newAchievement = {
        id: achievement.id,
        name: achievement.name,
        description: achievement.description,
        type: achievement.type,
        unlockedAt: new Date().toISOString(),
        icon: achievement.icon,
      };

      const updatedAchievements = [...currentAchievements, newAchievement];

      // Update profile
      await supabase
        .from("profiles")
        .update({
          stats: {
            ...profile.stats,
            achievements: updatedAchievements,
          },
        })
        .eq("id", userId);

      // Send push notification for achievement unlock
      try {
        await api.fetch("/api/push/send", {
          method: "POST",
          body: JSON.stringify({
            userId,
            payload: {
              type: "achievement",
              achievementName: achievement.name,
            },
          }),
        });
      } catch (error) {
        console.error("Error sending achievement notification:", error);
      }
    } catch (error) {
      console.error("Error unlocking achievement:", error);
    }
  }

  /**
   * Get current achievements for a user
   */
  static async getCurrentAchievements(userId: string): Promise<any[]> {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("stats")
        .eq("id", userId)
        .single();

      const achievements = profile?.stats?.achievements || [];
      return achievements;
    } catch (error) {
      console.error("Error getting current achievements:", error);
      return [];
    }
  }

  /**
   * Get achievement progress for a user
   */
  static async getAchievementProgress(userId: string): Promise<AchievementProgress[]> {
    const userStats = await this.getUserStats(userId);
    const currentAchievements = await this.getCurrentAchievements(userId);

    const progress = achievements.map((achievement) => {
      const unlocked = currentAchievements.find((a) => a.id === achievement.id);

      let currentValue = 0;
      switch (achievement.criteria.type) {
        case "streak_days":
          currentValue = userStats.currentStreak;
          break;
        case "total_reps":
          if (achievement.criteria.exerciseId) {
            currentValue = userStats.exerciseCounts[achievement.criteria.exerciseId] || 0;
          } else {
            currentValue = userStats.totalReps;
          }
          break;
        case "exercise_count":
          currentValue = userStats.totalSets;
          break;
        case "friend_count":
          currentValue = userStats.friendCount;
          break;
        case "total_steps":
          currentValue = userStats.maxStepsInDay;
          break;
        case "days_active":
          currentValue = userStats.daysActive;
          break;
        case "perfect_rolls":
          currentValue = userStats.perfectRolls;
          break;
        case "single_workout_reps":
          currentValue = 0; // This is checked per workout
          break;
      }

      // Cap the current value at the target value for completed achievements
      const targetValue = achievement.criteria.value;
      if (currentValue > targetValue) {
        currentValue = targetValue;
      }

      const result = {
        achievementId: achievement.id,
        currentValue,
        targetValue,
        isCompleted: !!unlocked,
        unlockedAt: unlocked?.unlockedAt ? new Date(unlocked.unlockedAt) : undefined,
      };

      console.log(`Achievement ${achievement.id}:`, result);
      return result;
    });

    console.log("Final progress array:", progress);
    return progress;
  }
}

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  type: "streak" | "exercise" | "social" | "steps" | "milestone";
  icon: string;
  criteria: {
    type:
      | "streak_days"
      | "total_reps"
      | "exercise_count"
      | "friend_count"
      | "total_steps"
      | "single_workout_reps"
      | "days_active"
      | "perfect_rolls";
    value: number;
    exerciseId?: number; // For exercise-specific achievements
  };
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  points: number;
}

export const achievements: AchievementDefinition[] = [
  // Streak Achievements
  {
    id: "first_streak",
    name: "Getting Started",
    description: "Complete workouts for 3 consecutive days",
    type: "streak",
    icon: "🔥",
    criteria: {
      type: "streak_days",
      value: 3,
    },
    rarity: "common",
    points: 10,
  },
  {
    id: "weekday_warrior",
    name: "Weekday Warrior",
    description: "Maintain a 5-day workout streak",
    type: "streak",
    icon: "⚡",
    criteria: {
      type: "streak_days",
      value: 5,
    },
    rarity: "uncommon",
    points: 25,
  },
  {
    id: "week_warrior",
    name: "Week Warrior",
    description: "Maintain a 7-day workout streak",
    type: "streak",
    icon: "⚡",
    criteria: {
      type: "streak_days",
      value: 7,
    },
    rarity: "rare",
    points: 27,
  },
  {
    id: "month_master",
    name: "Month Master",
    description: "Achieve a 30-day workout streak",
    type: "streak",
    icon: "👑",
    criteria: {
      type: "streak_days",
      value: 30,
    },
    rarity: "rare",
    points: 100,
  },

  // Exercise Achievements
  {
    id: "first_workout",
    name: "First Steps",
    description: "Complete your first workout",
    type: "exercise",
    icon: "🎯",
    criteria: {
      type: "exercise_count",
      value: 1,
    },
    rarity: "common",
    points: 5,
  },
  {
    id: "century_club",
    name: "Century Club",
    description: "Complete 100 total reps in a single workout",
    type: "exercise",
    icon: "💯",
    criteria: {
      type: "single_workout_reps",
      value: 100,
    },
    rarity: "uncommon",
    points: 30,
  },
  {
    id: "pushup_pro",
    name: "Push-up Pro",
    description: "Complete 50 push-ups in total",
    type: "exercise",
    icon: "💪",
    criteria: {
      type: "total_reps",
      value: 50,
      exerciseId: 2, // Pushup
    },
    rarity: "uncommon",
    points: 40,
  },

  // Social Achievements
  {
    id: "social_butterfly",
    name: "Social Butterfly",
    description: "Add 3 friends to your network",
    type: "social",
    icon: "🦋",
    criteria: {
      type: "friend_count",
      value: 3,
    },
    rarity: "common",
    points: 20,
  },

  // Steps Achievements
  {
    id: "step_counter",
    name: "Step Counter",
    description: "Walk 10,000 steps in a day",
    type: "steps",
    icon: "👟",
    criteria: {
      type: "total_steps",
      value: 10000,
    },
    rarity: "uncommon",
    points: 35,
  },
  {
    id: "hot_stepper",
    name: "Hot Stepper",
    description: "Walk 20,000 steps in a day",
    type: "steps",
    icon: "🌶️👟",
    criteria: {
      type: "total_steps",
      value: 20000,
    },
    rarity: "rare",
    points: 40,
  },
  {
    id: "toes_of_lightning",
    name: "Toes of Lightning",
    description: "Walk 30,000 steps in a day",
    type: "steps",
    icon: "👟⚡",
    criteria: {
      type: "total_steps",
      value: 30000,
    },
    rarity: "epic",
    points: 45,
  },

  // Milestone Achievements
  {
    id: "active_lifestyle",
    name: "Active Lifestyle",
    description: "Work out on 10 different days",
    type: "milestone",
    icon: "🌟",
    criteria: {
      type: "days_active",
      value: 10,
    },
    rarity: "uncommon",
    points: 50,
  },
  {
    id: "lucky_roller",
    name: "Lucky Roller",
    description: "Get a perfect dice roll (6,6) 5 times",
    type: "milestone",
    icon: "🎲",
    criteria: {
      type: "perfect_rolls",
      value: 5,
    },
    rarity: "rare",
    points: 75,
  },
];

export const getAchievementById = (id: string): AchievementDefinition | undefined => {
  return achievements.find((achievement) => achievement.id === id);
};

export const getAchievementsByType = (
  type: AchievementDefinition["type"]
): AchievementDefinition[] => {
  return achievements.filter((achievement) => achievement.type === type);
};

export const getAchievementsByRarity = (
  rarity: AchievementDefinition["rarity"]
): AchievementDefinition[] => {
  return achievements.filter((achievement) => achievement.rarity === rarity);
};

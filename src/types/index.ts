export type Exercise = {
  id: number;
  name: string;
  emoji?: string; // Optional since we now get it from centralized mapping
  splitId: string; // Which split this exercise belongs to
};

export type Split = {
  id: string;
  name: string;
  description: string;
  emoji: string;
  exercises: Exercise[];
  isDefault?: boolean;
};

export type DiceRoll = {
  exerciseDie: number;
  repsDie: number;
};

export type WorkoutSession = {
  id: string;
  timestamp: number;
  diceRoll: DiceRoll;
  exercise: Exercise;
  reps: number;
  multiplier: number;
};

export type ExerciseMultipliers = {
  [key: number]: number;
};

export type AppSettings = {
  notificationsEnabled: boolean;
  darkMode: boolean;
  userSplitId: string; // ID of the user's selected split
};

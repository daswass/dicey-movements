export type Exercise = {
  id: number;
  name: string;
  emoji: string;
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
};

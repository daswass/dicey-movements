import { Exercise, Split } from "../types";

// Define all available splits
export const splits: Split[] = [
  {
    id: "full-body",
    name: "Full Body",
    description: "Complete full-body workout with 6 fundamental exercises",
    isDefault: true,
    emoji: "🏋️",
    exercises: [
      { id: 1, name: "Jumping Jack", emoji: "🙆‍♂️", splitId: "full-body" },
      { id: 2, name: "Pushup", emoji: "💪", splitId: "full-body" },
      { id: 3, name: "Burpee", emoji: "↕️", splitId: "full-body" },
      { id: 4, name: "Squat", emoji: "🦵", splitId: "full-body" },
      { id: 5, name: "Situp", emoji: "🫃", splitId: "full-body" },
      { id: 6, name: "Pullup", emoji: "🧗", splitId: "full-body" },
    ],
  },
  {
    id: "upper-body",
    name: "Upper Body",
    description: "Focus on chest, arms, and shoulders",
    emoji: "💪",
    exercises: [
      { id: 1, name: "Pushup", emoji: "💪", splitId: "upper-body" },
      { id: 2, name: "Pullup", emoji: "🧗", splitId: "upper-body" },
      { id: 3, name: "Diamond Pushup", emoji: "💎", splitId: "upper-body" },
      { id: 4, name: "Incline Pushup", emoji: "📈", splitId: "upper-body" },
      { id: 5, name: "Tricep Dip", emoji: "⬇️", splitId: "upper-body" },
      { id: 6, name: "Pike Pushup", emoji: "🦈", splitId: "upper-body" },
    ],
  },
  {
    id: "lower-body",
    name: "Lower Body",
    description: "Focus on legs and glutes",
    emoji: "🦵",
    exercises: [
      { id: 1, name: "Squat", emoji: "🦵", splitId: "lower-body" },
      { id: 2, name: "Lunge", emoji: "🚶", splitId: "lower-body" },
      { id: 3, name: "Jump Squat", emoji: "🦘", splitId: "lower-body" },
      { id: 4, name: "Calf Raise", emoji: "🦿", splitId: "lower-body" },
      { id: 5, name: "Glute Bridge", emoji: "🍑", splitId: "lower-body" },
      { id: 6, name: "Wall Sit", emoji: "🧱", splitId: "lower-body" },
    ],
  },
  {
    id: "cardio",
    name: "Cardio",
    description: "High-intensity cardiovascular exercises",
    emoji: "🏃‍➡️",
    exercises: [
      { id: 1, name: "Jumping Jack", emoji: "🙆‍♂️", splitId: "cardio" },
      { id: 2, name: "Burpee", emoji: "↕️", splitId: "cardio" },
      { id: 3, name: "Mountain Climber", emoji: "🏔️", splitId: "cardio" },
      { id: 4, name: "High Knees", emoji: "🦵", splitId: "cardio" },
      { id: 5, name: "Butt Kicks", emoji: "🍑", splitId: "cardio" },
      { id: 6, name: "Jump Rope", emoji: "🪢", splitId: "cardio" },
    ],
  },
];

// Get the default split
export const getDefaultSplit = (): Split => {
  return splits.find((split) => split.isDefault) || splits[0];
};

// Get a split by ID
export const getSplitById = (id: string): Split => {
  const split = splits.find((split) => split.id === id);
  if (!split) {
    throw new Error(`Split with id ${id} not found`);
  }
  return split;
};

// Get exercises for a specific split
export const getExercisesBySplitId = (splitId: string): Exercise[] => {
  const split = getSplitById(splitId);
  return split.exercises;
};

// Get exercise by ID within a specific split
export const getExerciseById = (id: number, splitId: string): Exercise => {
  const exercises = getExercisesBySplitId(splitId);
  const exercise = exercises.find((ex) => ex.id === id);
  if (!exercise) {
    throw new Error(`Exercise with id ${id} not found in split ${splitId}`);
  }
  return exercise;
};

// Get all available exercises (for backward compatibility)
export const exercises: Exercise[] = getDefaultSplit().exercises;

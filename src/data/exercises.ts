import { Exercise, Split } from "../types";

// Centralized emoji mapping for all exercises
export const exerciseEmojis: Record<string, string> = {
  "Jumping Jack": "🦘",
  Pushup: "🙇",
  Burpee: "↕️",
  Squat: "🦵",
  Situp: "🫃",
  Pullup: "🧗",
  "Diamond Pushup": "💎",
  "Incline Pushup": "📈",
  "Tricep Dip": "⬇️",
  "Pike Pushup": "🦈",
  "Arnold Press": "🤷‍♂️",
  Lunge: "🚶",
  "Jump Squat": "🦘",
  "Calf Raise": "🦿",
  "Glute Bridge": "🍑",
  "Wall Sit": "🧱",
  "Mountain Climber": "🏔️",
  "High Knees": "🦵",
  "Butt Kicks": "🍑",
  "Jump Rope": "🪢",
  "Dumbbell Curl": "💪",
  "Dumbbell Kickback": "🔩",
  "Leg Raise": "🦵",
  "Belly Breath": "🫁",
  "Sun Salutation": "☀️",
  "Box Breath": "📦",
  "Grateful Breath": "🙏",
  "Smiling Seconds": "😊",
  "Alternate Nostril Breath": "👃",
};

// Helper function to get emoji for an exercise
export const getExerciseEmoji = (exerciseName: string): string => {
  return exerciseEmojis[exerciseName] || "🏃‍♂️"; // Default emoji if not found
};

// Define all available splits
export const splits: Split[] = [
  {
    id: "full-body",
    name: "Full Body",
    description: "Complete full-body workout with 6 fundamental exercises",
    isDefault: true,
    emoji: "🏋️",
    exercises: [
      { id: 1, name: "Jumping Jack", splitId: "full-body" },
      { id: 2, name: "Pushup", splitId: "full-body" },
      { id: 3, name: "Burpee", splitId: "full-body" },
      { id: 4, name: "Squat", splitId: "full-body" },
      { id: 5, name: "Situp", splitId: "full-body" },
      { id: 6, name: "Pullup", splitId: "full-body" },
    ],
  },
  {
    id: "upper-body",
    name: "Upper Body",
    description: "Focus on chest, arms, and shoulders",
    emoji: "💪",
    exercises: [
      { id: 1, name: "Pushup", splitId: "upper-body" },
      { id: 2, name: "Pullup", splitId: "upper-body" },
      { id: 3, name: "Diamond Pushup", splitId: "upper-body" },
      { id: 4, name: "Incline Pushup", splitId: "upper-body" },
      { id: 5, name: "Tricep Dip", splitId: "upper-body" },
      { id: 6, name: "Pike Pushup", splitId: "upper-body" },
    ],
  },
  {
    id: "lower-body",
    name: "Lower Body",
    description: "Focus on legs and glutes",
    emoji: "🦵",
    exercises: [
      { id: 1, name: "Squat", splitId: "lower-body" },
      { id: 2, name: "Lunge", splitId: "lower-body" },
      { id: 3, name: "Jump Squat", splitId: "lower-body" },
      { id: 4, name: "Calf Raise", splitId: "lower-body" },
      { id: 5, name: "Glute Bridge", splitId: "lower-body" },
      { id: 6, name: "Wall Sit", splitId: "lower-body" },
    ],
  },
  {
    id: "cardio",
    name: "Cardio",
    description: "High-intensity cardiovascular exercises",
    emoji: "🏃‍➡️",
    exercises: [
      { id: 1, name: "Jumping Jack", splitId: "cardio" },
      { id: 2, name: "Burpee", splitId: "cardio" },
      { id: 3, name: "Mountain Climber", splitId: "cardio" },
      { id: 4, name: "High Knees", splitId: "cardio" },
      { id: 5, name: "Butt Kicks", splitId: "cardio" },
      { id: 6, name: "Jump Rope", splitId: "cardio" },
    ],
  },
  {
    id: "arms-and-abs",
    name: "Arms and Abs",
    description: "Focus on arms and abs",
    emoji: "💪➕🛡️",
    exercises: [
      { id: 1, name: "Pushup", splitId: "arms-and-abs" },
      { id: 2, name: "Situp", splitId: "arms-and-abs" },
      { id: 3, name: "Arnold Press", splitId: "arms-and-abs" },
      { id: 4, name: "Dumbbell Curl", splitId: "arms-and-abs" },
      { id: 5, name: "Dumbbell Kickback", splitId: "arms-and-abs" },
      { id: 6, name: "Leg Raise", splitId: "arms-and-abs" },
    ],
  },
  {
    id: "mindfulness",
    name: "Mindfulness",
    description: "Focus on being present and mindful",
    emoji: "🧘‍♂️",
    exercises: [
      { id: 1, name: "Belly Breath", splitId: "mindfulness" },
      { id: 2, name: "Sun Salutation", splitId: "mindfulness" },
      { id: 3, name: "Box Breath", splitId: "mindfulness" },
      { id: 4, name: "Grateful Breath", splitId: "mindfulness" },
      { id: 5, name: "Smiling Seconds", splitId: "mindfulness" },
      { id: 6, name: "Alternate Nostril Breath", splitId: "mindfulness" },
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

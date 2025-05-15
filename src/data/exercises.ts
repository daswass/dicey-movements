import { Exercise } from "../types";

export const exercises: Exercise[] = [
  { id: 1, name: "Jumping Jack", emoji: "🦘" },
  { id: 2, name: "Pushup", emoji: "💪" },
  { id: 3, name: "Burpee", emoji: "↕️" },
  { id: 4, name: "Squat", emoji: "🦵" },
  { id: 5, name: "Situp", emoji: "🫃" },
  { id: 6, name: "Pullup", emoji: "🧗" },
];

export const getExerciseById = (id: number): Exercise => {
  const exercise = exercises.find((ex) => ex.id === id);
  if (!exercise) {
    throw new Error(`Exercise with id ${id} not found`);
  }
  return exercise;
};

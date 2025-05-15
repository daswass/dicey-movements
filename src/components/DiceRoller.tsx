import React, { useState } from "react";
import { getExerciseById } from "../data/exercises";
import { DiceRoll, WorkoutSession, ExerciseMultipliers } from "../types";

interface DiceRollerProps {
  onRollComplete: (session: WorkoutSession) => void;
  multipliers: ExerciseMultipliers;
  rollCompleted: boolean;
}

const DiceRoller: React.FC<DiceRollerProps> = ({ onRollComplete, multipliers, rollCompleted }) => {
  const [isRolling, setIsRolling] = useState<boolean>(false);
  const [diceValues, setDiceValues] = useState<DiceRoll | null>(null);

  const rollDice = () => {
    setIsRolling(true);

    const animationDuration = 1500;
    const frames = 15;
    const interval = animationDuration / frames;

    let frame = 0;
    const rollInterval = setInterval(() => {
      setDiceValues({
        exerciseDie: Math.floor(Math.random() * 6) + 1,
        repsDie: Math.floor(Math.random() * 6) + 1,
      });

      frame++;
      if (frame >= frames) {
        clearInterval(rollInterval);

        const finalExerciseDie = Math.floor(Math.random() * 6) + 1;
        const finalRepsDie = Math.floor(Math.random() * 6) + 1;

        setDiceValues({
          exerciseDie: finalExerciseDie,
          repsDie: finalRepsDie,
        });

        setIsRolling(false);

        const exercise = getExerciseById(finalExerciseDie);
        const exerciseMultiplier = multipliers[finalExerciseDie];
        const totalReps = finalRepsDie * exerciseMultiplier;

        const session: WorkoutSession = {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          diceRoll: {
            exerciseDie: finalExerciseDie,
            repsDie: finalRepsDie,
          },
          exercise,
          reps: totalReps,
          multiplier: exerciseMultiplier,
        };

        onRollComplete(session);
      }
    }, interval);
  };

  return (
    <div className="flex flex-col items-center">
      <div className="flex justify-center space-x-8 mb-8">
        <div className="flex flex-col items-center">
          <div
            className={`w-24 h-24 rounded-lg flex items-center justify-center text-4xl bg-gradient-to-br from-blue-500 to-blue-600 text-white font-bold shadow-lg mb-2 ${
              isRolling ? "animate-bounce" : ""
            }`}>
            {diceValues?.exerciseDie || "?"}
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400">Exercise</span>
        </div>

        <div className="flex flex-col items-center">
          <div
            className={`w-24 h-24 rounded-lg flex items-center justify-center text-4xl bg-gradient-to-br from-red-500 to-red-600 text-white font-bold shadow-lg mb-2 ${
              isRolling ? "animate-bounce" : ""
            }`}
            style={{ animationDelay: "0.1s" }}>
            {diceValues?.repsDie || "?"}
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400">Reps</span>
        </div>
      </div>

      {diceValues && !isRolling && (
        <div className="mb-6 text-center">
          <p className="text-lg">
            Roll result:{" "}
            <span className="font-semibold">{getExerciseById(diceValues.exerciseDie).name}</span>
            {" × "}
            <span className="font-semibold">{diceValues.repsDie}</span>
            <span className="text-blue-600 dark:text-blue-400">
              {" "}
              × {multipliers[diceValues.exerciseDie]} (multiplier)
            </span>
            {" = "}
            <span className="font-bold text-xl">
              {diceValues.repsDie * multipliers[diceValues.exerciseDie]} reps
            </span>
          </p>
        </div>
      )}

      {!rollCompleted && (
        <button
          onClick={rollDice}
          disabled={isRolling}
          className={`px-6 py-3 rounded-lg text-lg font-semibold ${
            isRolling
              ? "bg-gray-300 cursor-not-allowed dark:bg-gray-700"
              : "bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 shadow-md hover:shadow-lg transform hover:-translate-y-1 transition-all"
          }`}>
          {isRolling ? "Rolling..." : "Roll Dice"}
        </button>
      )}
    </div>
  );
};

export default DiceRoller;

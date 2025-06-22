import React, { useEffect, useState } from "react";
import { getExerciseById } from "../data/exercises";
import { DiceRoll, ExerciseMultipliers, WorkoutSession } from "../types";
import Dice from "./Dice"; // 1. Import the Dice component

interface DiceRollerProps {
  onRollComplete: (session: WorkoutSession) => void;
  multipliers: ExerciseMultipliers;
  rollCompleted: boolean;
  session?: WorkoutSession | null;
}

const DiceRoller: React.FC<DiceRollerProps> = ({
  onRollComplete,
  multipliers,
  rollCompleted,
  session,
}) => {
  const [isRolling, setIsRolling] = useState<boolean>(false);
  const [diceValues, setDiceValues] = useState<DiceRoll | null>(null);

  useEffect(() => {
    if (session?.diceRoll) {
      setDiceValues(session.diceRoll);
    }
  }, [session]);

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
        setDiceValues({ exerciseDie: finalExerciseDie, repsDie: finalRepsDie });
        setIsRolling(false);
        const exercise = getExerciseById(finalExerciseDie);
        const exerciseMultiplier = multipliers[finalExerciseDie];
        const totalReps = finalRepsDie * exerciseMultiplier;
        const session: WorkoutSession = {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          diceRoll: { exerciseDie: finalExerciseDie, repsDie: finalRepsDie },
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
          {/* 2. Replace the text number with the Dice component */}
          <Dice
            value={diceValues?.exerciseDie}
            className={`w-24 h-24 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg mb-2 ${
              isRolling ? "animate-bounce" : ""
            }`}
          />
          <span className="text-sm text-gray-500 dark:text-gray-400">Exercise</span>
        </div>

        <div className="flex flex-col items-center">
          {/* 3. Do the same for the Reps die */}
          <Dice
            value={diceValues?.repsDie}
            className={`w-24 h-24 rounded-lg bg-gradient-to-br from-red-500 to-red-600 text-white shadow-lg mb-2 ${
              isRolling ? "animate-bounce" : ""
            }`}
            style={{ animationDelay: "0.1s" }}
          />
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

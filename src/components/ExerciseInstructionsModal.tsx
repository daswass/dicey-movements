import React from "react";
import { Exercise } from "../types";

interface ExerciseInstructionsModalProps {
  exercise: Exercise | null;
  isOpen: boolean;
  onClose: () => void;
}

const ExerciseInstructionsModal: React.FC<ExerciseInstructionsModalProps> = ({
  exercise,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !exercise) return null;

  // Exercise instructions database
  const exerciseInstructions: Record<
    string,
    {
      description: string;
      steps: string[];
      tips: string[];
      muscles: string[];
    }
  > = {
    "Jumping Jack": {
      description:
        "A full-body cardiovascular exercise that combines jumping with arm and leg movements.",
      steps: [
        "Stand with your feet together and arms at your sides",
        "Jump up while spreading your legs shoulder-width apart",
        "Simultaneously raise your arms above your head",
        "Jump back to the starting position",
        "Repeat the movement continuously",
      ],
      tips: [
        "Land softly on the balls of your feet",
        "Keep your core engaged throughout the movement",
        "Maintain a steady rhythm",
        "Breathe steadily",
      ],
      muscles: ["Cardiovascular", "Legs", "Shoulders", "Core"],
    },
    Pushup: {
      description: "A classic upper body exercise that targets chest, shoulders, and triceps.",
      steps: [
        "Start in a plank position with hands slightly wider than shoulders",
        "Lower your body by bending your elbows",
        "Keep your body in a straight line from head to heels",
        "Lower until your chest nearly touches the ground",
        "Push back up to the starting position",
      ],
      tips: [
        "Keep your core tight throughout the movement",
        "Don't let your hips sag or rise",
        "Breathe out as you push up",
        "Start with modified pushups if needed",
      ],
      muscles: ["Chest", "Triceps", "Shoulders", "Core"],
    },
    Burpee: {
      description: "A high-intensity full-body exercise that combines squat, pushup, and jump.",
      steps: [
        "Start standing with feet shoulder-width apart",
        "Drop into a squat position and place hands on the ground",
        "Kick feet back into a plank position",
        "Perform a pushup (optional for beginners)",
        "Jump feet back to squat position",
        "Jump up with arms overhead",
      ],
      tips: [
        "Maintain good form even when tired",
        "Land softly from the jump",
        "Keep your core engaged throughout",
        "Start slow and build up speed",
      ],
      muscles: ["Full Body", "Cardiovascular", "Legs", "Chest", "Core"],
    },
    Squat: {
      description: "A fundamental lower body exercise that targets multiple muscle groups.",
      steps: [
        "Stand with feet shoulder-width apart",
        "Keep your chest up and core engaged",
        "Lower your body by bending at the knees and hips",
        "Go down until thighs are parallel to the ground",
        "Keep your knees in line with your toes",
        "Push back up to starting position",
      ],
      tips: [
        "Keep your weight in your heels",
        "Don't let your knees cave inward",
        "Keep your chest up throughout",
        "Go as deep as you can while maintaining form",
      ],
      muscles: ["Quadriceps", "Glutes", "Hamstrings", "Core"],
    },
    Situp: {
      description: "A core exercise that targets abdominal muscles.",
      steps: [
        "Lie on your back with knees bent and feet flat",
        "Place your hands behind your head or across your chest",
        "Engage your core muscles",
        "Lift your upper body toward your knees",
        "Lower back down with control",
      ],
      tips: [
        "Don't pull on your neck with your hands",
        "Focus on using your abs, not momentum",
        "Keep your lower back pressed to the ground",
        "Breathe steadily throughout",
      ],
      muscles: ["Rectus Abdominis", "Obliques", "Core"],
    },
    Pullup: {
      description: "An upper body exercise that primarily targets back and biceps.",
      steps: [
        "Grab the pullup bar with hands slightly wider than shoulders",
        "Hang with arms fully extended",
        "Pull your body up until your chin is above the bar",
        "Lower your body back down with control",
        "Repeat the movement",
      ],
      tips: [
        "Engage your back muscles, not just your arms",
        "Keep your core tight throughout",
        "Don't swing or use momentum",
        "Start with assisted pullups if needed",
      ],
      muscles: ["Lats", "Biceps", "Rear Deltoids", "Core"],
    },
    "Diamond Pushup": {
      description: "A variation of the pushup that targets triceps more intensely.",
      steps: [
        "Start in a plank position",
        "Place your hands together forming a diamond shape",
        "Lower your body while keeping elbows close to your body",
        "Push back up to starting position",
      ],
      tips: [
        "Keep your elbows close to your sides",
        "Maintain a straight body line",
        "Focus on using your triceps",
        "Start with regular pushups if this is too difficult",
      ],
      muscles: ["Triceps", "Chest", "Shoulders", "Core"],
    },
    "Incline Pushup": {
      description: "An easier variation of the pushup using an elevated surface.",
      steps: [
        "Place your hands on an elevated surface (bench, step, etc.)",
        "Position your body in a plank position",
        "Lower your chest toward the surface",
        "Push back up to starting position",
      ],
      tips: [
        "The higher the surface, the easier the exercise",
        "Keep your body in a straight line",
        "Engage your core throughout",
        "Great for building up to regular pushups",
      ],
      muscles: ["Chest", "Triceps", "Shoulders", "Core"],
    },
    "Tricep Dip": {
      description: "An exercise that targets the triceps using body weight.",
      steps: [
        "Sit on the edge of a bench or chair",
        "Place your hands on the edge next to your hips",
        "Slide your butt off the edge",
        "Lower your body by bending your elbows",
        "Push back up to starting position",
      ],
      tips: [
        "Keep your elbows close to your body",
        "Don't go too deep if it causes shoulder discomfort",
        "Keep your core engaged",
        "Focus on using your triceps",
      ],
      muscles: ["Triceps", "Shoulders", "Chest"],
    },
    "Pike Pushup": {
      description: "A pushup variation that targets shoulders more than chest.",
      steps: [
        "Start in a downward dog position",
        "Lower your head toward the ground",
        "Keep your hips high throughout the movement",
        "Push back up to starting position",
      ],
      tips: [
        "Keep your core engaged",
        "Focus on using your shoulders",
        "Don't let your hips drop",
        "Great progression toward handstand pushups",
      ],
      muscles: ["Shoulders", "Triceps", "Core"],
    },
    Lunge: {
      description: "A lower body exercise that works each leg independently.",
      steps: [
        "Stand with feet hip-width apart",
        "Step forward with one leg",
        "Lower your body until both knees are bent at 90 degrees",
        "Keep your front knee over your ankle",
        "Push back to starting position",
        "Repeat with the other leg",
      ],
      tips: [
        "Keep your upper body upright",
        "Don't let your front knee go past your toes",
        "Engage your core for balance",
        "Keep your back knee close to the ground",
      ],
      muscles: ["Quadriceps", "Glutes", "Hamstrings", "Core"],
    },
    "Jump Squat": {
      description: "A plyometric variation of the squat that adds explosive power.",
      steps: [
        "Start in a squat position",
        "Explosively jump up from the squat",
        "Land softly back in the squat position",
        "Immediately repeat the movement",
      ],
      tips: [
        "Land softly to protect your joints",
        "Keep your core engaged throughout",
        "Don't pause between jumps",
        "Focus on explosive power",
      ],
      muscles: ["Quadriceps", "Glutes", "Hamstrings", "Core", "Cardiovascular"],
    },
    "Calf Raise": {
      description: "An isolation exercise that targets the calf muscles.",
      steps: [
        "Stand with feet hip-width apart",
        "Raise your heels off the ground",
        "Hold briefly at the top",
        "Lower your heels back down",
        "Repeat the movement",
      ],
      tips: [
        "Keep your knees slightly bent",
        "Focus on the contraction at the top",
        "Control the movement in both directions",
        "You can do this on a step for more range of motion",
      ],
      muscles: ["Gastrocnemius", "Soleus"],
    },
    "Glute Bridge": {
      description: "An exercise that targets the glutes and hamstrings.",
      steps: [
        "Lie on your back with knees bent and feet flat",
        "Place your arms at your sides",
        "Lift your hips off the ground",
        "Squeeze your glutes at the top",
        "Lower back down with control",
      ],
      tips: [
        "Focus on using your glutes, not your lower back",
        "Keep your core engaged",
        "Don't overextend your back",
        "Hold the top position briefly",
      ],
      muscles: ["Glutes", "Hamstrings", "Core"],
    },
    "Wall Sit": {
      description: "An isometric exercise that builds leg endurance.",
      steps: [
        "Lean your back against a wall",
        "Slide down until your thighs are parallel to the ground",
        "Keep your back pressed against the wall",
        "Hold the position for the specified time",
      ],
      tips: [
        "Keep your knees over your ankles",
        "Don't let your knees go past your toes",
        "Breathe steadily throughout",
        "Start with shorter holds and build up",
      ],
      muscles: ["Quadriceps", "Glutes", "Core"],
    },
    "Mountain Climber": {
      description: "A dynamic core exercise that also provides cardiovascular benefits.",
      steps: [
        "Start in a plank position",
        "Drive one knee toward your chest",
        "Quickly switch legs",
        "Continue alternating legs in a running motion",
      ],
      tips: [
        "Keep your core engaged throughout",
        "Don't let your hips move up and down",
        "Maintain a steady rhythm",
        "Focus on form over speed",
      ],
      muscles: ["Core", "Shoulders", "Cardiovascular"],
    },
    "High Knees": {
      description: "A cardio exercise that mimics running in place.",
      steps: [
        "Stand with feet hip-width apart",
        "Run in place, bringing knees up high",
        "Pump your arms as you would when running",
        "Maintain a steady rhythm",
      ],
      tips: [
        "Keep your core engaged",
        "Land softly on the balls of your feet",
        "Maintain good posture",
        "Start slow and build up speed",
      ],
      muscles: ["Cardiovascular", "Core", "Legs"],
    },
    "Butt Kicks": {
      description: "A cardio exercise that targets the hamstrings.",
      steps: [
        "Stand with feet hip-width apart",
        "Run in place, kicking your heels toward your butt",
        "Keep your upper body stable",
        "Maintain a steady rhythm",
      ],
      tips: [
        "Keep your core engaged",
        "Focus on the hamstring contraction",
        "Don't lean forward",
        "Start slow and build up speed",
      ],
      muscles: ["Hamstrings", "Cardiovascular", "Core"],
    },
    "Jump Rope": {
      description: "A classic cardio exercise that improves coordination and endurance.",
      steps: [
        "Hold the jump rope handles at hip level",
        "Swing the rope over your head",
        "Jump over the rope as it comes toward your feet",
        "Land softly and immediately jump again",
        "Maintain a steady rhythm",
      ],
      tips: [
        "Keep your elbows close to your body",
        "Jump just high enough to clear the rope",
        "Land softly on the balls of your feet",
        "Start with basic jumps before adding variations",
      ],
      muscles: ["Cardiovascular", "Calves", "Core", "Shoulders"],
    },
  };

  const instructions = exerciseInstructions[exercise.name] || {
    description: "Exercise instructions coming soon!",
    steps: ["Detailed steps will be added for this exercise."],
    tips: ["Helpful tips will be provided."],
    muscles: ["Muscle groups will be listed."],
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <span className="text-4xl">{exercise.emoji}</span>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{exercise.name}</h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors text-2xl">
              &times;
            </button>
          </div>

          <div className="space-y-6">
            {/* Description */}
            <div>
              <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
                Description
              </h3>
              <p className="text-gray-600 dark:text-gray-300">{instructions.description}</p>
            </div>

            {/* Steps */}
            <div>
              <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
                How to Perform
              </h3>
              <ol className="list-decimal list-inside space-y-2 text-gray-600 dark:text-gray-300">
                {instructions.steps.map((step, index) => (
                  <li key={index} className="pl-2">
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            {/* Tips */}
            <div>
              <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Pro Tips</h3>
              <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-300">
                {instructions.tips.map((tip, index) => (
                  <li key={index} className="pl-2">
                    {tip}
                  </li>
                ))}
              </ul>
            </div>

            {/* Muscles Worked */}
            <div>
              <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
                Muscles Worked
              </h3>
              <div className="flex flex-wrap gap-2">
                {instructions.muscles.map((muscle, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium">
                    {muscle}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExerciseInstructionsModal;

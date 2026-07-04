import { Trophy } from "lucide-react";
import { lazy, Suspense } from "react";

const Leaderboard = lazy(() =>
  import("./Leaderboard").then((module) => ({ default: module.Leaderboard }))
);

function TabLoading() {
  return (
    <div className="flex justify-center py-8 text-gray-500 dark:text-gray-400 text-sm">
      Loading...
    </div>
  );
}

const SocialFeatures = () => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
      <div className="flex items-center space-x-2 mb-6">
        <Trophy size={20} className="text-blue-500" />
        <h3 className="text-xl font-semibold">Leaderboard</h3>
      </div>

      <Suspense fallback={<TabLoading />}>
        <Leaderboard />
      </Suspense>
    </div>
  );
};

export default SocialFeatures;

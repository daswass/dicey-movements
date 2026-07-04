import confetti from "canvas-confetti";
import { Crown, MapPin } from "lucide-react";
import React, { useEffect, useState } from "react";
import { nameUnnamedZone, UNNAMED_ZONE_DISPLAY } from "../utils/zoneService";

export interface WorkoutCompleteHeistInfo {
  zoneId: string;
  zoneName: string;
  previousCaptain?: string;
  totalReps: number;
  isHeist: boolean;
  canNameZone: boolean;
}

interface WorkoutCompleteModalProps {
  heist?: WorkoutCompleteHeistInfo;
  onDismiss?: () => void;
}

function fireConfetti() {
  const colors = ["#FBBF24", "#EF4444", "#8B5CF6", "#3B82F6", "#10B981", "#EC4899"];
  const duration = 2800;
  const end = Date.now() + duration;

  confetti({
    particleCount: 120,
    spread: 80,
    origin: { y: 0.55 },
    colors,
  });

  const burst = () => {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 65,
      origin: { x: 0, y: 0.6 },
      colors,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 65,
      origin: { x: 1, y: 0.6 },
      colors,
    });

    if (Date.now() < end) {
      requestAnimationFrame(burst);
    }
  };

  burst();
}

export const WorkoutCompleteModal: React.FC<WorkoutCompleteModalProps> = ({ heist, onDismiss }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [zoneNameInput, setZoneNameInput] = useState("");
  const [namingError, setNamingError] = useState<string | null>(null);
  const [isSavingName, setIsSavingName] = useState(false);

  const showSheisterUI = Boolean(heist && (heist.isHeist || heist.canNameZone));
  const isHeist = Boolean(heist?.isHeist);

  useEffect(() => {
    const showTimer = setTimeout(() => setIsVisible(true), 30);
    return () => clearTimeout(showTimer);
  }, []);

  useEffect(() => {
    if (isHeist) {
      fireConfetti();
    }
  }, [isHeist]);

  const handleDismiss = () => {
    onDismiss?.();
  };

  const handleSaveName = async () => {
    if (!heist?.canNameZone || !heist.zoneId) {
      handleDismiss();
      return;
    }

    setIsSavingName(true);
    setNamingError(null);

    const result = await nameUnnamedZone(heist.zoneId, zoneNameInput);
    setIsSavingName(false);

    if (!result.ok) {
      setNamingError(result.error);
      return;
    }

    handleDismiss();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 pointer-events-none">
      <div
        className={`pointer-events-auto transform transition-all duration-400 ease-out max-w-md w-full text-center ${
          isVisible ? "scale-100 opacity-100" : "scale-90 opacity-0"
        } ${
          showSheisterUI
            ? "bg-gradient-to-br from-purple-900 via-gray-900 to-red-900 border-2 border-yellow-400 rounded-2xl shadow-2xl p-8"
            : "bg-gray-800 rounded-lg shadow-xl p-8"
        }`}>
        {showSheisterUI ? (
          <>
            {isHeist ?
              <>
                <div className="text-6xl mb-3 animate-bounce">🎲</div>
                <h2 className="text-3xl font-bold text-yellow-400 mb-2 tracking-wide">DICE HEIST!</h2>
                <p className="text-lg text-gray-200 mb-1">That's like you — and then some!</p>
                <p className="text-sm text-gray-400 mb-5">You just seized the zone. Sheister secured.</p>
              </>
            : <>
                <div className="text-5xl mb-3">👑</div>
                <h2 className="text-2xl font-bold text-yellow-400 mb-2">Zone Sheister!</h2>
                <p className="text-sm text-gray-400 mb-5">You claimed this zone.</p>
              </>
            }

            <div className="bg-gray-800/80 rounded-xl p-4 border border-gray-600">
              <div className="flex items-center justify-center gap-2 text-blue-400 mb-2">
                <MapPin size={18} />
                <span className="font-semibold">{heist!.zoneName}</span>
              </div>
              {heist!.previousCaptain && isHeist && (
                <p className="text-sm text-gray-400">
                  Out-sheistered{" "}
                  <span className="text-red-400 font-medium">{heist!.previousCaptain}</span>
                </p>
              )}
              <p className="text-2xl font-bold text-white mt-2 flex items-center justify-center gap-2">
                <Crown size={22} className="text-yellow-500" />
                {heist!.totalReps} reps this week
              </p>
              <p className="text-xs text-yellow-500 mt-1 uppercase tracking-widest">Zone Sheister</p>
            </div>

            {heist!.canNameZone && (
              <div className="mt-5 text-left">
                <label htmlFor="zone-name" className="block text-sm text-gray-300 mb-2">
                  Name this zone (optional)
                </label>
                <input
                  id="zone-name"
                  type="text"
                  maxLength={40}
                  value={zoneNameInput}
                  onChange={(e) => {
                    setZoneNameInput(e.target.value);
                    setNamingError(null);
                  }}
                  placeholder={UNNAMED_ZONE_DISPLAY}
                  className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400"
                />
                {namingError && <p className="text-red-400 text-sm mt-2">{namingError}</p>}
                <div className="flex gap-3 mt-4">
                  <button
                    type="button"
                    onClick={handleDismiss}
                    disabled={isSavingName}
                    className="flex-1 px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700/50 disabled:opacity-50">
                    Skip
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveName}
                    disabled={isSavingName || !zoneNameInput.trim()}
                    className="flex-1 px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-semibold disabled:opacity-50">
                    {isSavingName ? "Saving…" : "Save Name"}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <h2 className="text-4xl mb-4">🙌</h2>
            <p className="text-xl text-white">That's like you!</p>
          </>
        )}
      </div>
    </div>
  );
};

import React, { useEffect, useState } from "react";

interface HighFiveEffectProps {
  isActive: boolean;
  onComplete?: () => void;
}

interface Emoji {
  id: number;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  opacity: number;
}

export const HighFiveEffect: React.FC<HighFiveEffectProps> = ({ isActive, onComplete }) => {
  const [emojis, setEmojis] = useState<Emoji[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isActive && !isAnimating) {
      startHighFiveEffect();
    }
  }, [isActive]);

  const startHighFiveEffect = () => {
    setIsAnimating(true);

    // Create initial emojis
    const initialEmojis: Emoji[] = Array.from({ length: 20 }, (_, index) => ({
      id: index,
      x: Math.random() * window.innerWidth,
      y: -50, // Start above the viewport
      rotation: Math.random() * 360,
      scale: 0.5 + Math.random() * 0.5,
      opacity: 1,
    }));

    setEmojis(initialEmojis);

    // Animate emojis falling
    const animationDuration = 3000;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / animationDuration;

      if (progress < 1) {
        setEmojis((prevEmojis) =>
          prevEmojis.map((emoji) => ({
            ...emoji,
            y: emoji.y + 3 + Math.random() * 2, // Fall down
            rotation: emoji.rotation + 2, // Rotate
            opacity: progress > 0.7 ? 1 - (progress - 0.7) / 0.3 : 1, // Fade out near end
          }))
        );
        requestAnimationFrame(animate);
      } else {
        // Animation complete
        setEmojis([]);
        setIsAnimating(false);
        onComplete?.();
      }
    };

    requestAnimationFrame(animate);
  };

  if (!isActive || emojis.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {emojis.map((emoji) => (
        <div
          key={emoji.id}
          className="absolute text-4xl animate-bounce"
          style={{
            left: `${emoji.x}px`,
            top: `${emoji.y}px`,
            transform: `rotate(${emoji.rotation}deg) scale(${emoji.scale})`,
            opacity: emoji.opacity,
            transition: "opacity 0.3s ease-out",
          }}>
          ✋
        </div>
      ))}
    </div>
  );
};

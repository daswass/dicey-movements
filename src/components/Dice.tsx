import React from "react";

interface DiceProps {
  value?: number;
  className?: string;
  style?: React.CSSProperties;
}

const Dot = () => (
  <div
    style={{
      width: "0.5rem", // Equivalent to Tailwind's w-2
      height: "0.5rem", // Equivalent to Tailwind's h-2
      backgroundColor: "currentColor",
      borderRadius: "9999px", // Equivalent to Tailwind's rounded-full
    }}
  />
);

const Dice: React.FC<DiceProps> = ({ value, className, style }) => {
  const layoutClasses = "p-2 grid grid-cols-3 grid-rows-3 gap-1";

  const DotContainer: React.FC<{ gridPos: string }> = ({ gridPos }) => (
    <div className={`${gridPos} flex justify-center items-center`}>
      <Dot />
    </div>
  );

  const renderDots = () => {
    const dotPositions: { [key: number]: string[] } = {
      1: ["col-start-2 row-start-2"],
      2: ["col-start-1 row-start-1", "col-start-3 row-start-3"],
      3: ["col-start-1 row-start-1", "col-start-2 row-start-2", "col-start-3 row-start-3"],
      4: [
        "col-start-1 row-start-1",
        "col-start-1 row-start-3",
        "col-start-3 row-start-1",
        "col-start-3 row-start-3",
      ],
      5: [
        "col-start-1 row-start-1",
        "col-start-1 row-start-3",
        "col-start-2 row-start-2",
        "col-start-3 row-start-1",
        "col-start-3 row-start-3",
      ],
      6: [
        "col-start-1 row-start-1",
        "col-start-1 row-start-2",
        "col-start-1 row-start-3",
        "col-start-3 row-start-1",
        "col-start-3 row-start-2",
        "col-start-3 row-start-3",
      ],
    };

    const positions = value ? dotPositions[value] : [];
    if (!positions) return null;

    return positions.map((pos) => <DotContainer key={pos} gridPos={pos} />);
  };

  if (!value || value < 1 || value > 6) {
    return (
      <div
        style={style}
        className={`${className} flex items-center justify-center text-5xl font-bold opacity-50`}>
        ?
      </div>
    );
  }

  return (
    <div style={style} className={`${className} ${layoutClasses}`}>
      {renderDots()}
    </div>
  );
};

export default Dice;

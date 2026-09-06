import { describe, expect, it, vi } from "vitest";
import { mapLeaderboardRows } from "./leaderboard";

describe("mapLeaderboardRows", () => {
  const rows = [
    { user_id: "user-1", username: "Alice", score: "12", location: "Queens" },
    { user_id: "user-2", username: null, score: 4, location: null },
  ];

  it("maps bigint RPC scores and profile fallbacks", () => {
    const previousScores = new Map<string, number>();

    expect(mapLeaderboardRows(rows, previousScores, "2026-09-06T12:00:00.000Z", vi.fn())).toEqual([
      {
        id: "user-1",
        user_id: "user-1",
        username: "Alice",
        score: 12,
        location: "Queens",
        timestamp: "2026-09-06T12:00:00.000Z",
        scoreChange: undefined,
      },
      {
        id: "user-2",
        user_id: "user-2",
        username: "Unknown User",
        score: 4,
        location: "Unknown",
        timestamp: "2026-09-06T12:00:00.000Z",
        scoreChange: undefined,
      },
    ]);
    expect(previousScores).toEqual(
      new Map([
        ["user-1", 12],
        ["user-2", 4],
      ])
    );
  });

  it("detects score changes and defers updating changed previous scores", () => {
    const previousScores = new Map([
      ["user-1", 10],
      ["user-2", 5],
    ]);
    const scheduleUpdate = vi.fn();

    const entries = mapLeaderboardRows(rows, previousScores, "now", scheduleUpdate);

    expect(entries.map((entry) => entry.scoreChange)).toEqual(["increase", "decrease"]);
    expect(scheduleUpdate).toHaveBeenCalledTimes(2);
    expect(scheduleUpdate).toHaveBeenNthCalledWith(1, "user-1", 12);
    expect(scheduleUpdate).toHaveBeenNthCalledWith(2, "user-2", 4);
    expect(previousScores).toEqual(
      new Map([
        ["user-1", 10],
        ["user-2", 5],
      ])
    );
  });
});

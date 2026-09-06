export interface LeaderboardRpcRow {
  user_id: string;
  username: string | null;
  score: number | string;
  location: string | null;
}

export interface LeaderboardEntry {
  id: string;
  user_id: string;
  username: string;
  score: number;
  location: string;
  timestamp: string;
  scoreChange?: "increase" | "decrease";
}

export const mapLeaderboardRows = (
  rows: LeaderboardRpcRow[],
  previousScores: Map<string, number>,
  now: string,
  schedulePreviousScoreUpdate: (userId: string, score: number) => void
): LeaderboardEntry[] =>
  rows.map((row) => {
    const score = Number(row.score);
    const previousScore = previousScores.get(row.user_id);
    let scoreChange: "increase" | "decrease" | undefined;

    if (previousScore !== undefined && score !== previousScore) {
      scoreChange = score > previousScore ? "increase" : "decrease";
      schedulePreviousScoreUpdate(row.user_id, score);
    } else {
      previousScores.set(row.user_id, score);
    }

    return {
      id: row.user_id,
      user_id: row.user_id,
      username: row.username || "Unknown User",
      score,
      location: row.location || "Unknown",
      timestamp: now,
      scoreChange,
    };
  });

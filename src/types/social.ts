export interface UserProfile {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  location: {
    city: string;
    country: string;
    coordinates: {
      latitude: number;
      longitude: number;
    };
  };
  stats: {
    totalReps: number;
    totalSets: number;
    streak: number;
    achievements: Achievement[];
  };
  friends: string[]; // Array of friend user IDs
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  score: number;
  location: string;
  timestamp: Date;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  type: "location" | "exercise" | "streak" | "social";
  unlockedAt: Date;
  icon: string;
}

export interface FriendActivity {
  userId: string;
  username: string;
  activity: {
    type: "workout" | "achievement" | "streak";
    details: string;
    timestamp: Date;
  };
}

export interface Challenge {
  id: string;
  fromUserId: string;
  toUserId: string;
  exerciseId: number;
  reps: number;
  deadline: Date;
  status: "pending" | "accepted" | "completed" | "declined";
}

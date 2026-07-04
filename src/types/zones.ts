export interface ZoneBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface ZoneInfo {
  id: string;
  latIndex: number;
  lngIndex: number;
  bounds: ZoneBounds;
  center: { latitude: number; longitude: number };
  displayName: string;
}

export interface ZoneCaptain {
  zoneId: string;
  captainUserId: string;
  captainUsername: string;
  totalReps: number;
}

export interface ZoneStandings {
  zoneId: string;
  userId: string;
  username: string;
  totalReps: number;
}

export interface DiceHeistResult {
  isHeist: boolean;
  becameSheister: boolean;
  zoneIsUnnamed: boolean;
  zoneInfo: ZoneInfo;
  previousCaptain?: string;
  newTotalReps: number;
}

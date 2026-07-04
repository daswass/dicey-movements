import { DiceHeistResult, ZoneBounds, ZoneCaptain, ZoneInfo, ZoneStandings } from "../types/zones";
import { supabase } from "./supabaseClient";

/** Public label for zones without a custom name. */
export const UNNAMED_ZONE_DISPLAY = "Unnamed Zone";

/** ~2km grid cells at mid-latitudes. Keeps zones neighborhood-sized. */
export const ZONE_GRID_SIZE = 0.02;

const CAPTAIN_COLORS = [
  "#3B82F6",
  "#EF4444",
  "#10B981",
  "#F59E0B",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#F97316",
  "#84CC16",
  "#6366F1",
  "#14B8A6",
  "#A855F7",
];

const UNCLAIMED_COLOR = "#374151";

export type ZoneCaptainRelation = "self" | "friend" | "other";

export const ZONE_RELATION_COLORS: Record<ZoneCaptainRelation, string> = {
  self: "#15803d",
  friend: "#3B82F6",
  other: "#EF4444",
};

export function getCaptainRelation(
  captainUserId: string,
  currentUserId: string,
  friendIds: ReadonlySet<string>
): ZoneCaptainRelation {
  if (captainUserId === currentUserId) return "self";
  if (friendIds.has(captainUserId)) return "friend";
  return "other";
}

export function getZoneColorByRelation(relation: ZoneCaptainRelation): string {
  return ZONE_RELATION_COLORS[relation];
}

export function getZoneColorForCaptain(
  captainUserId: string,
  currentUserId: string,
  friendIds: ReadonlySet<string>
): string {
  return getZoneColorByRelation(getCaptainRelation(captainUserId, currentUserId, friendIds));
}

export async function fetchFriendIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("friends")
    .select("user_id, friend_id")
    .eq("status", "accepted")
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

  if (error || !data) {
    console.error("zoneService: failed to fetch friends", error);
    return new Set();
  }

  return new Set(data.map((row) => (row.user_id === userId ? row.friend_id : row.user_id)));
}

export function resolveZoneDisplayName(
  zoneId: string,
  zoneNames: ReadonlyMap<string, string>
): string {
  return zoneNames.get(zoneId)?.trim() || UNNAMED_ZONE_DISPLAY;
}

export async function fetchZoneNames(zoneIds: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (zoneIds.length === 0) {
    return names;
  }

  const uniqueIds = [...new Set(zoneIds)];
  const { data, error } = await supabase.from("zone_names").select("zone_id, name").in("zone_id", uniqueIds);

  if (error) {
    console.error("zoneService: failed to fetch zone names", error);
    return names;
  }

  for (const row of data || []) {
    if (row.name?.trim()) {
      names.set(row.zone_id, row.name.trim());
    }
  }

  return names;
}

export async function isZoneUnnamed(zoneId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("zone_names")
    .select("zone_id")
    .eq("zone_id", zoneId)
    .maybeSingle();

  if (error) {
    console.error("zoneService: failed to check zone name", error);
    return true;
  }

  return !data;
}

export async function nameUnnamedZone(
  zoneId: string,
  name: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = name.trim();
  if (!trimmed) {
    return { ok: false, error: "Enter a zone name" };
  }

  const { error } = await supabase.rpc("name_unnamed_zone", {
    p_zone_id: zoneId,
    p_name: trimmed,
  });

  if (error) {
    console.error("zoneService: failed to name zone", error);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export function latLngToIndices(latitude: number, longitude: number) {
  return {
    latIndex: Math.floor(latitude / ZONE_GRID_SIZE),
    lngIndex: Math.floor(longitude / ZONE_GRID_SIZE),
  };
}

export function indicesToZoneId(latIndex: number, lngIndex: number): string {
  return `${latIndex}_${lngIndex}`;
}

export function zoneIdToIndices(zoneId: string): { latIndex: number; lngIndex: number } {
  const [latIndex, lngIndex] = zoneId.split("_").map(Number);
  return { latIndex, lngIndex };
}

export function getZoneBounds(latIndex: number, lngIndex: number): ZoneBounds {
  return {
    south: latIndex * ZONE_GRID_SIZE,
    west: lngIndex * ZONE_GRID_SIZE,
    north: (latIndex + 1) * ZONE_GRID_SIZE,
    east: (lngIndex + 1) * ZONE_GRID_SIZE,
  };
}

export function getZoneFromCoordinates(
  latitude: number,
  longitude: number
): ZoneInfo {
  const { latIndex, lngIndex } = latLngToIndices(latitude, longitude);
  const bounds = getZoneBounds(latIndex, lngIndex);
  const center = {
    latitude: (bounds.south + bounds.north) / 2,
    longitude: (bounds.west + bounds.east) / 2,
  };

  return {
    id: indicesToZoneId(latIndex, lngIndex),
    latIndex,
    lngIndex,
    bounds,
    center,
    displayName: UNNAMED_ZONE_DISPLAY,
  };
}

export function getZoneInfoFromId(zoneId: string): ZoneInfo {
  const { latIndex, lngIndex } = zoneIdToIndices(zoneId);
  const bounds = getZoneBounds(latIndex, lngIndex);
  const center = {
    latitude: (bounds.south + bounds.north) / 2,
    longitude: (bounds.west + bounds.east) / 2,
  };

  return {
    id: zoneId,
    latIndex,
    lngIndex,
    bounds,
    center,
    displayName: UNNAMED_ZONE_DISPLAY,
  };
}

/** Approximate zone radius in meters for map circles. */
export function getZoneRadiusMeters(latitude: number): number {
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLng = 111320 * Math.cos((latitude * Math.PI) / 180);
  const halfLat = (ZONE_GRID_SIZE / 2) * metersPerDegreeLat;
  const halfLng = (ZONE_GRID_SIZE / 2) * metersPerDegreeLng;
  return Math.sqrt(halfLat * halfLat + halfLng * halfLng);
}

export function getCaptainColor(userId?: string): string {
  if (!userId) return UNCLAIMED_COLOR;
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CAPTAIN_COLORS[Math.abs(hash) % CAPTAIN_COLORS.length];
}

export function getUnclaimedColor(): string {
  return UNCLAIMED_COLOR;
}

/** Zones visible in a map viewport, plus padding cells around the edges. */
export function getZonesInBounds(
  south: number,
  west: number,
  north: number,
  east: number,
  padding = 1
): ZoneInfo[] {
  const minLat = Math.floor(south / ZONE_GRID_SIZE) - padding;
  const maxLat = Math.floor(north / ZONE_GRID_SIZE) + padding;
  const minLng = Math.floor(west / ZONE_GRID_SIZE) - padding;
  const maxLng = Math.floor(east / ZONE_GRID_SIZE) + padding;

  const zones: ZoneInfo[] = [];
  for (let latIndex = minLat; latIndex <= maxLat; latIndex++) {
    for (let lngIndex = minLng; lngIndex <= maxLng; lngIndex++) {
      const bounds = getZoneBounds(latIndex, lngIndex);
      zones.push({
        id: indicesToZoneId(latIndex, lngIndex),
        latIndex,
        lngIndex,
        bounds,
        center: {
          latitude: (bounds.south + bounds.north) / 2,
          longitude: (bounds.west + bounds.east) / 2,
        },
        displayName: UNNAMED_ZONE_DISPLAY,
      });
    }
  }
  return zones;
}

export async function fetchZoneCaptains(): Promise<ZoneCaptain[]> {
  const { data, error } = await supabase.rpc("get_zone_captains");

  if (error) {
    console.warn("zoneService: RPC unavailable, falling back to client aggregation", error);
    return fetchZoneCaptainsFallback();
  }

  return (data || []).map(
    (row: {
      zone_id: string;
      captain_user_id: string;
      captain_username: string;
      total_reps: number;
    }) => ({
      zoneId: row.zone_id,
      captainUserId: row.captain_user_id,
      captainUsername: row.captain_username,
      totalReps: Number(row.total_reps),
    })
  );
}

async function fetchZoneCaptainsFallback(): Promise<ZoneCaptain[]> {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { data, error } = await supabase
    .from("activities")
    .select("zone_id, user_id, reps, profiles(username)")
    .gte("timestamp", weekAgo.toISOString())
    .not("zone_id", "is", null);

  if (error || !data) {
    console.error("zoneService: failed to fetch activities for captains", error);
    return [];
  }

  const scores = new Map<string, Map<string, { username: string; reps: number }>>();

  for (const row of data) {
    if (!row.zone_id) continue;
    const profile = row.profiles as { username: string } | null;
    const username = profile?.username || "Unknown";
    const zoneScores = scores.get(row.zone_id) || new Map();
    const existing = zoneScores.get(row.user_id) || { username, reps: 0 };
    existing.reps += row.reps;
    zoneScores.set(row.user_id, existing);
    scores.set(row.zone_id, zoneScores);
  }

  const captains: ZoneCaptain[] = [];
  for (const [zoneId, zoneScores] of scores) {
    let topUserId = "";
    let topUsername = "";
    let topReps = 0;
    for (const [userId, { username, reps }] of zoneScores) {
      if (reps > topReps) {
        topUserId = userId;
        topUsername = username;
        topReps = reps;
      }
    }
    if (topUserId) {
      captains.push({
        zoneId,
        captainUserId: topUserId,
        captainUsername: topUsername,
        totalReps: topReps,
      });
    }
  }

  return captains;
}

export async function fetchZoneStandings(zoneId: string): Promise<ZoneStandings[]> {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { data, error } = await supabase
    .from("activities")
    .select("user_id, reps, profiles(username)")
    .eq("zone_id", zoneId)
    .gte("timestamp", weekAgo.toISOString());

  if (error || !data) return [];

  const standings = new Map<string, ZoneStandings>();
  for (const row of data) {
    const profile = row.profiles as { username: string } | null;
    const existing = standings.get(row.user_id) || {
      zoneId,
      userId: row.user_id,
      username: profile?.username || "Unknown",
      totalReps: 0,
    };
    existing.totalReps += row.reps;
    standings.set(row.user_id, existing);
  }

  return Array.from(standings.values()).sort((a, b) => b.totalReps - a.totalReps);
}

export async function checkDiceHeist(
  zoneId: string,
  userId: string,
  addedReps: number,
  zoneInfo: ZoneInfo
): Promise<DiceHeistResult> {
  const captains = await fetchZoneCaptains();
  const currentCaptain = captains.find((c) => c.zoneId === zoneId);
  const previousCaptainId = currentCaptain?.captainUserId;

  const standings = await fetchZoneStandings(zoneId);
  const userStanding = standings.find((s) => s.userId === userId);
  const newTotalReps = (userStanding?.totalReps || 0) + addedReps;

  const previousUserReps = userStanding?.totalReps || 0;
  const topAmongOthers = standings
    .filter((s) => s.userId !== userId)
    .reduce((max, s) => Math.max(max, s.totalReps), 0);

  const zoneIsUnnamed = await isZoneUnnamed(zoneId);

  const wasSheister = previousUserReps > topAmongOthers;
  const isNowSheister = newTotalReps > topAmongOthers;
  const becameSheister = !wasSheister && isNowSheister;
  const isHeist =
    becameSheister && previousCaptainId !== undefined && previousCaptainId !== userId;

  return {
    isHeist,
    becameSheister,
    zoneIsUnnamed,
    zoneInfo,
    previousCaptain: currentCaptain?.captainUsername,
    newTotalReps,
  };
}

export function buildZoneFromLocation(location?: {
  coordinates?: { latitude: number; longitude: number };
  city?: string;
}): { zoneId: string | null; zoneInfo: ZoneInfo | null } {
  const coords = location?.coordinates;
  if (!coords || (coords.latitude === 0 && coords.longitude === 0)) {
    return { zoneId: null, zoneInfo: null };
  }

  const zoneInfo = getZoneFromCoordinates(coords.latitude, coords.longitude);
  return { zoneId: zoneInfo.id, zoneInfo };
}

export function buildZoneIdFromProfile(
  location?: { coordinates?: { latitude: number; longitude: number }; city?: string }
): string | null {
  return buildZoneFromLocation(location).zoneId;
}

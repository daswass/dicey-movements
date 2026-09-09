import { describe, expect, it, vi } from "vitest";

// Zone grid helpers are pure; keep this unit suite independent of runtime Supabase credentials.
vi.mock("./supabaseClient", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));
import {
  UNNAMED_ZONE_DISPLAY,
  ZONE_GRID_SIZE,
  buildZoneFromLocation,
  getCaptainRelation,
  getZoneBounds,
  getZoneColorForCaptain,
  getZoneFromCoordinates,
  getZoneViewport,
  indicesToZoneId,
  latLngToIndices,
  resolveZoneDisplayName,
  zoneIdToIndices,
} from "./zoneService";

describe("zone grid helpers", () => {
  it("maps coordinates to stable zone indices", () => {
    expect(latLngToIndices(40.758, -73.9855)).toEqual({
      latIndex: Math.floor(40.758 / ZONE_GRID_SIZE),
      lngIndex: Math.floor(-73.9855 / ZONE_GRID_SIZE),
    });
  });

  it("round-trips zone ids", () => {
    const zoneId = indicesToZoneId(2037, -3699);
    expect(zoneIdToIndices(zoneId)).toEqual({ latIndex: 2037, lngIndex: -3699 });
  });

  it("builds bounds from indices", () => {
    expect(getZoneBounds(10, 20)).toEqual({
      south: 10 * ZONE_GRID_SIZE,
      west: 20 * ZONE_GRID_SIZE,
      north: (10 + 1) * ZONE_GRID_SIZE,
      east: (20 + 1) * ZONE_GRID_SIZE,
    });
  });

  it("creates zone info with unnamed display label", () => {
    const zone = getZoneFromCoordinates(40.758, -73.9855);
    expect(zone.id).toBe(
      indicesToZoneId(
        Math.floor(40.758 / ZONE_GRID_SIZE),
        Math.floor(-73.9855 / ZONE_GRID_SIZE)
      )
    );
    expect(zone.displayName).toBe(UNNAMED_ZONE_DISPLAY);
  });
});

describe("resolveZoneDisplayName", () => {
  it("returns custom name when set", () => {
    const names = new Map([["2037_-3699", "The Gym Block"]]);
    expect(resolveZoneDisplayName("2037_-3699", names)).toBe("The Gym Block");
  });

  it("falls back to unnamed label", () => {
    expect(resolveZoneDisplayName("2037_-3699", new Map())).toBe(UNNAMED_ZONE_DISPLAY);
  });
});

describe("buildZoneFromLocation", () => {
  it("returns null for missing coordinates", () => {
    expect(buildZoneFromLocation(undefined)).toEqual({ zoneId: null, zoneInfo: null });
  });

  it("returns null for placeholder 0,0 coordinates", () => {
    expect(
      buildZoneFromLocation({
        coordinates: { latitude: 0, longitude: 0 },
        city: "Unknown",
      })
    ).toEqual({ zoneId: null, zoneInfo: null });
  });

  it("returns zone for valid coordinates", () => {
    const result = buildZoneFromLocation({
      coordinates: { latitude: 40.758, longitude: -73.9855 },
      city: "New York",
    });

    expect(result.zoneId).not.toBeNull();
    expect(result.zoneInfo?.displayName).toBe(UNNAMED_ZONE_DISPLAY);
  });
});

describe("captain relation colors", () => {
  const friends = new Set(["friend-1"]);

  it("identifies self, friend, and other captains", () => {
    expect(getCaptainRelation("me", "me", friends)).toBe("self");
    expect(getCaptainRelation("friend-1", "me", friends)).toBe("friend");
    expect(getCaptainRelation("stranger", "me", friends)).toBe("other");
  });

  it("maps relations to colors", () => {
    expect(getZoneColorForCaptain("me", "me", friends)).toBe("#15803d");
    expect(getZoneColorForCaptain("friend-1", "me", friends)).toBe("#3B82F6");
    expect(getZoneColorForCaptain("stranger", "me", friends)).toBe("#EF4444");
  });
});


describe("zone viewport bounds", () => {
  it("converts a map viewport to bounded grid indices", () => {
    expect(getZoneViewport(40.70, -74.03, 40.74, -73.98)).toEqual({
      minLatIndex: Math.floor(40.70 / ZONE_GRID_SIZE) - 1,
      maxLatIndex: Math.floor(40.74 / ZONE_GRID_SIZE) + 1,
      minLngIndex: Math.floor(-74.03 / ZONE_GRID_SIZE) - 1,
      maxLngIndex: Math.floor(-73.98 / ZONE_GRID_SIZE) + 1,
    });
  });

  it("refuses all-world viewports before any RPC can be made", () => {
    expect(getZoneViewport(-90, -180, 90, 180)).toBeNull();
  });
});

import L from "leaflet";
import { Crown, MapPin, RefreshCw } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Circle, MapContainer, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { UserProfile } from "../types/social";
import { ZoneCaptain, ZoneInfo, ZoneStandings } from "../types/zones";
import {
  fetchFriendIds,
  fetchZoneCaptainsInViewport,
  fetchZoneNames,
  fetchZoneStandings,
  getCaptainRelation,
  getZoneColorByRelation,
  getZoneFromCoordinates,
  getZoneViewport,
  getZoneInfoFromId,
  getZoneRadiusMeters,
  nameUnnamedZone,
  resolveZoneDisplayName,
  UNNAMED_ZONE_DISPLAY,
  ZONE_RELATION_COLORS,
  ZoneCaptainRelation,
} from "../utils/zoneService";
import "leaflet/dist/leaflet.css";

interface ZoneMapProps {
  userProfile: UserProfile | null;
}

/** Concentric rings that fade from solid color at center to transparent at edge. */
const GRADIENT_RINGS = [
  { scale: 1.0, opacity: 0.06 },
  { scale: 0.82, opacity: 0.1 },
  { scale: 0.64, opacity: 0.16 },
  { scale: 0.46, opacity: 0.24 },
  { scale: 0.28, opacity: 0.34 },
];

const SELF_GRADIENT_RINGS = [
  { scale: 1.0, opacity: 0.14 },
  { scale: 0.82, opacity: 0.22 },
  { scale: 0.64, opacity: 0.32 },
  { scale: 0.46, opacity: 0.44 },
  { scale: 0.28, opacity: 0.58 },
];

function withDisplayName(zone: ZoneInfo, zoneNames: ReadonlyMap<string, string>): ZoneInfo {
  return {
    ...zone,
    displayName: resolveZoneDisplayName(zone.id, zoneNames),
  };
}

interface ClaimedZoneCircleProps {
  zone: ZoneInfo;
  captain: ZoneCaptain;
  color: string;
  relation: ZoneCaptainRelation;
  isUserZone: boolean;
  onSelect: (zone: ZoneInfo) => void;
}

const ClaimedZoneCircle: React.FC<ClaimedZoneCircleProps> = ({
  zone,
  captain,
  color,
  relation,
  isUserZone,
  onSelect,
}) => {
  const center: [number, number] = [zone.center.latitude, zone.center.longitude];
  const baseRadius = getZoneRadiusMeters(zone.center.latitude);
  const rings = relation === "self" ? SELF_GRADIENT_RINGS : GRADIENT_RINGS;

  return (
    <>
      {rings.map((ring, index) => (
        <Circle
          key={`${zone.id}-ring-${index}`}
          center={center}
          radius={baseRadius * ring.scale}
          pathOptions={{
            fillColor: color,
            fillOpacity: ring.opacity,
            stroke: false,
            weight: 0,
          }}
          eventHandlers={{ click: () => onSelect(zone) }}
        />
      ))}

      {isUserZone && (
        <Circle
          center={center}
          radius={baseRadius * 1.05}
          pathOptions={{
            fillOpacity: 0,
            color: "#FBBF24",
            weight: 2,
            opacity: 0.7,
            dashArray: "6 4",
          }}
        />
      )}

      <Circle
        center={center}
        radius={baseRadius}
        pathOptions={{
          fillOpacity: 0,
          stroke: false,
          weight: 0,
        }}
        eventHandlers={{ click: () => onSelect(zone) }}>
        <Tooltip sticky>
          <div className="text-sm">
            <div className="font-semibold">{zone.displayName}</div>
            <div className="flex items-center gap-1">
              <Crown size={12} className="text-yellow-500" />
              Sheister: {captain.captainUsername} ({captain.totalReps} reps)
            </div>
          </div>
        </Tooltip>
      </Circle>
    </>
  );
};

function MapBoundsTracker({
  onBoundsChange,
}: {
  onBoundsChange: (bounds: L.LatLngBounds) => void;
}) {
  const map = useMap();

  useEffect(() => {
    onBoundsChange(map.getBounds());
  }, [map, onBoundsChange]);

  useMapEvents({
    moveend: () => onBoundsChange(map.getBounds()),
    zoomend: () => onBoundsChange(map.getBounds()),
  });

  return null;
}

function RecenterButton({ center }: { center: [number, number] }) {
  const map = useMap();
  return (
    <button
      onClick={() => map.setView(center, map.getZoom())}
      className="absolute top-3 right-3 z-[1000] bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-lg shadow-lg text-sm flex items-center gap-2 border border-gray-600">
      <MapPin size={16} />
      My Zone
    </button>
  );
}

function FlyToZone({ center }: { center: [number, number] | null }) {
  const map = useMap();

  useEffect(() => {
    if (center) {
      map.flyTo(center, Math.max(map.getZoom(), 14), { duration: 0.8 });
    }
  }, [center, map]);

  return null;
}

const ZoneMap: React.FC<ZoneMapProps> = ({ userProfile }) => {
  const [captains, setCaptains] = useState<ZoneCaptain[]>([]);
  const [zoneNames, setZoneNames] = useState<Map<string, string>>(new Map());
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null);
  const [selectedZone, setSelectedZone] = useState<ZoneInfo | null>(null);
  const [standings, setStandings] = useState<ZoneStandings[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [zoneNameInput, setZoneNameInput] = useState("");
  const [namingZoneId, setNamingZoneId] = useState<string | null>(null);
  const [namingError, setNamingError] = useState<string | null>(null);
  const [isSavingName, setIsSavingName] = useState(false);
  const [focusZoneCenter, setFocusZoneCenter] = useState<[number, number] | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [viewportTooLarge, setViewportTooLarge] = useState(false);

  const userCoords = userProfile?.location?.coordinates;
  const hasLocation = userCoords && !(userCoords.latitude === 0 && userCoords.longitude === 0);

  const userZone = useMemo(() => {
    if (!hasLocation) return null;
    return withDisplayName(
      getZoneFromCoordinates(userCoords.latitude, userCoords.longitude),
      zoneNames
    );
  }, [hasLocation, userCoords, zoneNames]);

  const mapCenter: [number, number] =
    hasLocation ? [userCoords.latitude, userCoords.longitude] : [40.7128, -74.006];

  const userSheisterZones = useMemo(() => {
    if (!userProfile?.id) return [];
    return captains
      .filter((captain) => captain.captainUserId === userProfile.id)
      .map((captain) => ({
        captain,
        zone: withDisplayName(getZoneInfoFromId(captain.zoneId), zoneNames),
      }))
      .sort((a, b) => b.captain.totalReps - a.captain.totalReps);
  }, [captains, userProfile?.id, zoneNames]);

  const userSheisterZoneIds = useMemo(
    () => new Set(userSheisterZones.map(({ zone }) => zone.id)),
    [userSheisterZones]
  );

  const claimedZonesInView = useMemo(() => {
    return captains
      .map((captain) => ({
        captain,
        zone: withDisplayName(getZoneInfoFromId(captain.zoneId), zoneNames),
      }))
      .filter(({ zone }) => {
        if (!mapBounds) return true;
        return mapBounds.contains([zone.center.latitude, zone.center.longitude]);
      });
  }, [captains, mapBounds, zoneNames]);

  useEffect(() => {
    if (!userProfile?.id) {
      setFriendIds(new Set());
      return;
    }
    let cancelled = false;
    void fetchFriendIds(userProfile.id).then((friends) => {
      if (!cancelled) setFriendIds(friends);
    });
    return () => { cancelled = true; };
  }, [userProfile?.id]);

  useEffect(() => {
    if (!mapBounds) return;
    const viewport = getZoneViewport(
      mapBounds.getSouth(),
      mapBounds.getWest(),
      mapBounds.getNorth(),
      mapBounds.getEast()
    );
    if (!viewport) {
      setViewportTooLarge(true);
      setCaptains([]);
      setZoneNames(new Map());
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setViewportTooLarge(false);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      void (async () => {
        setRefreshing(true);
        try {
          const data = await fetchZoneCaptainsInViewport(viewport, controller.signal);
          if (controller.signal.aborted) return;
          const names = await fetchZoneNames(data.map((captain) => captain.zoneId));
          if (controller.signal.aborted) return;
          setCaptains(data);
          setZoneNames(names);
        } finally {
          if (!controller.signal.aborted) {
            setLoading(false);
            setRefreshing(false);
          }
        }
      })();
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [mapBounds, refreshNonce]);

  const handleBoundsChange = useCallback((bounds: L.LatLngBounds) => {
    setMapBounds(bounds);
  }, []);

  const handleZoneClick = useCallback(
    async (zone: ZoneInfo) => {
      const namedZone = withDisplayName(zone, zoneNames);
      setSelectedZone(namedZone);
      const data = await fetchZoneStandings(zone.id);
      setStandings(data);
    },
    [zoneNames]
  );

  const captainMap = useMemo(() => {
    const map = new Map<string, ZoneCaptain>();
    for (const captain of captains) {
      map.set(captain.zoneId, captain);
    }
    return map;
  }, [captains]);

  const handleSelectZone = useCallback(
    async (zone: ZoneInfo) => {
      setFocusZoneCenter([zone.center.latitude, zone.center.longitude]);
      await handleZoneClick(zone);
    },
    [handleZoneClick]
  );

  const handleSaveZoneName = async (zoneId: string) => {
    setIsSavingName(true);
    setNamingError(null);

    const result = await nameUnnamedZone(zoneId, zoneNameInput);
    setIsSavingName(false);

    if (!result.ok) {
      setNamingError(result.error);
      return;
    }

    const trimmed = zoneNameInput.trim();
    setZoneNames((prev) => new Map(prev).set(zoneId, trimmed));
    setZoneNameInput("");
    setNamingZoneId(null);
    setNamingError(null);
    if (selectedZone?.id === zoneId) {
      setSelectedZone((prev) => (prev ? { ...prev, displayName: trimmed } : null));
    }
  };

  const uniqueCaptains = useMemo(() => {
    const seen = new Map<string, ZoneCaptain>();
    for (const captain of captains) {
      if (!seen.has(captain.captainUserId)) {
        seen.set(captain.captainUserId, captain);
      }
    }
    return Array.from(seen.values());
  }, [captains]);

  const selectedZoneDisplayName =
    selectedZone ? resolveZoneDisplayName(selectedZone.id, zoneNames) : "Zone Standings";

  const legendItems = [
    { relation: "self" as const, label: "You" },
    { relation: "friend" as const, label: "Friends" },
    { relation: "other" as const, label: "Other" },
  ];

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Plan a Dice Heist</h1>
        <p className="text-gray-400 text-sm sm:text-base">
          Claimed zones glow on the map — <span className="text-green-500">green</span> for you,{" "}
          <span className="text-blue-400">blue</span> for friends,{" "}
          <span className="text-red-400">red</span> for everyone else. Take over a zone for a{" "}
          <span className="text-yellow-400 font-semibold">Dice Heist!</span>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2">
          <div className="relative rounded-xl overflow-hidden border border-gray-700 shadow-xl">
            {!hasLocation && (
              <div className="absolute top-3 left-3 right-3 z-[1000] bg-yellow-900/90 text-yellow-200 px-4 py-2 rounded-lg text-sm">
                Enable location access to see your zone on the map.
              </div>
            )}

            <button
              onClick={() => setRefreshNonce((value) => value + 1)}
              disabled={refreshing}
              className="absolute top-3 left-3 z-[1000] bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-lg shadow-lg text-sm flex items-center gap-2 border border-gray-600 disabled:opacity-50">
              <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>

            <MapContainer
              center={mapCenter}
              zoom={hasLocation ? 14 : 4}
              className="h-[260px] sm:h-[380px] lg:h-[500px] w-full z-0"
              scrollWheelZoom>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapBoundsTracker onBoundsChange={handleBoundsChange} />
              <FlyToZone center={focusZoneCenter} />
              {hasLocation && <RecenterButton center={mapCenter} />}

              {claimedZonesInView.map(({ zone, captain }) => {
                const relation = getCaptainRelation(
                  captain.captainUserId,
                  userProfile?.id || "",
                  friendIds
                );

                return (
                  <ClaimedZoneCircle
                    key={zone.id}
                    zone={zone}
                    captain={captain}
                    color={getZoneColorByRelation(relation)}
                    relation={relation}
                    isUserZone={userSheisterZoneIds.has(zone.id)}
                    onSelect={handleZoneClick}
                  />
                );
              })}
            </MapContainer>
          </div>

          <div className="mt-3 sm:mt-4 flex flex-wrap gap-2 sm:gap-3">
            {legendItems.map(({ relation, label }) => (
              <div
                key={relation}
                className="flex items-center gap-2 bg-gray-800 px-3 py-1.5 rounded-full text-sm border border-gray-700">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: ZONE_RELATION_COLORS[relation] }}
                />
                <span className="text-gray-200">{label}</span>
              </div>
            ))}
            {viewportTooLarge && (
              <span className="text-gray-500 text-sm">Zoom in to load claimed zones.</span>
            )}
            {uniqueCaptains.length === 0 && !loading && !viewportTooLarge && (
              <span className="text-gray-500 text-sm">No zones claimed yet — be the first!</span>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {userProfile?.id && (
            <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <Crown size={18} className="text-yellow-500" />
                Your Visible Sheister Zones
              </h2>
              {userSheisterZones.length === 0 && !loading && (
                <p className="text-gray-500 text-sm">
                  No zones under your control yet — complete a workout to claim one.
                </p>
              )}
              {userSheisterZones.length > 0 && (
                <ul className="space-y-2">
                  {userSheisterZones.map(({ zone, captain }) => {
                    const isCurrentLocation = userZone?.id === zone.id;
                    const isSelected = selectedZone?.id === zone.id;
                    const isUnnamed = !zoneNames.has(zone.id);
                    const isNaming = namingZoneId === zone.id;

                    return (
                      <li key={zone.id} className="rounded-lg border border-gray-700 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => handleSelectZone(zone)}
                          className={`w-full text-left px-3 py-2.5 transition-colors ${
                            isSelected ?
                              "bg-yellow-900/30 border-yellow-700/50"
                            : "bg-gray-700/50 hover:bg-gray-700"
                          }`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-gray-100 font-medium truncate">{zone.displayName}</p>
                              {isCurrentLocation && (
                                <p className="text-xs text-blue-400 mt-0.5">Current location</p>
                              )}
                            </div>
                            <span className="text-gray-400 font-mono text-sm shrink-0">
                              {captain.totalReps} reps
                            </span>
                          </div>
                        </button>

                        {isUnnamed && (
                          <div className="px-3 py-2 bg-gray-900/50 border-t border-gray-700">
                            {isNaming ?
                              <>
                                <input
                                  type="text"
                                  maxLength={40}
                                  value={zoneNameInput}
                                  onChange={(e) => {
                                    setZoneNameInput(e.target.value);
                                    setNamingError(null);
                                  }}
                                  placeholder={UNNAMED_ZONE_DISPLAY}
                                  className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400 text-sm"
                                />
                                {namingError && (
                                  <p className="text-red-400 text-xs mt-1">{namingError}</p>
                                )}
                                <div className="flex gap-2 mt-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setNamingZoneId(null);
                                      setZoneNameInput("");
                                      setNamingError(null);
                                    }}
                                    disabled={isSavingName}
                                    className="flex-1 px-3 py-1.5 rounded-lg border border-gray-600 text-gray-300 text-sm hover:bg-gray-700/50 disabled:opacity-50">
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveZoneName(zone.id)}
                                    disabled={isSavingName || !zoneNameInput.trim()}
                                    className="flex-1 px-3 py-1.5 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-semibold text-sm disabled:opacity-50">
                                    {isSavingName ? "Saving…" : "Save"}
                                  </button>
                                </div>
                              </>
                            : <button
                                type="button"
                                onClick={() => {
                                  setNamingZoneId(zone.id);
                                  setZoneNameInput("");
                                  setNamingError(null);
                                }}
                                className="text-xs text-yellow-400 hover:text-yellow-300">
                                Name this zone
                              </button>
                            }
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {userZone && (
            <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <MapPin size={18} className="text-blue-400" />
                Your Zone
              </h2>
              <p className="text-gray-300 font-medium">{userZone.displayName}</p>
              {(() => {
                const captain = captainMap.get(userZone.id);
                if (captain && captain.captainUserId === userProfile?.id) {
                  return (
                    <p className="text-yellow-400 mt-2 flex items-center gap-1">
                      <Crown size={16} /> You're the Zone Sheister! ({captain.totalReps} reps)
                    </p>
                  );
                }
                if (captain) {
                  return (
                    <p className="text-gray-400 mt-2">
                      Sheister: <span className="text-white">{captain.captainUsername}</span> (
                      {captain.totalReps} reps)
                    </p>
                  );
                }
                return <p className="text-green-400 mt-2">Unclaimed — go claim it!</p>;
              })()}
            </div>
          )}

          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <h2 className="text-lg font-semibold text-white mb-3">{selectedZoneDisplayName}</h2>
            {!selectedZone && (
              <p className="text-gray-500 text-sm">
                Click a claimed zone on the map to see standings.
              </p>
            )}
            {selectedZone && standings.length === 0 && (
              <p className="text-gray-500 text-sm">No activity in this zone this week.</p>
            )}
            {standings.length > 0 && (
              <ol className="space-y-2">
                {standings.map((entry, index) => {
                  const relation = getCaptainRelation(
                    entry.userId,
                    userProfile?.id || "",
                    friendIds
                  );
                  const dotColor = getZoneColorByRelation(relation);

                  return (
                    <li
                      key={entry.userId}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                        index === 0 ?
                          "bg-yellow-900/30 border border-yellow-700/50"
                        : "bg-gray-700/50"
                      }`}>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 w-5 text-right">{index + 1}.</span>
                        {index === 0 && <Crown size={14} className="text-yellow-500" />}
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: dotColor }}
                        />
                        <span className="text-gray-200">{entry.username}</span>
                      </div>
                      <span className="text-gray-400 font-mono text-sm">{entry.totalReps}</span>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ZoneMap;

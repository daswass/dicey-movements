import L from "leaflet";
import { Crown, MapPin, RefreshCw } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Circle, MapContainer, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { UserProfile } from "../types/social";
import { ZoneCaptain, ZoneInfo, ZoneStandings } from "../types/zones";
import {
  fetchFriendIds,
  fetchZoneCaptains,
  fetchZoneStandings,
  getCaptainRelation,
  getZoneColorByRelation,
  getZoneColorForCaptain,
  getZoneFromCoordinates,
  getZoneInfoFromId,
  getZoneRadiusMeters,
  ZONE_RELATION_COLORS,
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

interface ClaimedZoneCircleProps {
  zone: ZoneInfo;
  captain: ZoneCaptain;
  color: string;
  isUserZone: boolean;
  onSelect: (zone: ZoneInfo) => void;
}

const ClaimedZoneCircle: React.FC<ClaimedZoneCircleProps> = ({
  zone,
  captain,
  color,
  isUserZone,
  onSelect,
}) => {
  const center: [number, number] = [zone.center.latitude, zone.center.longitude];
  const baseRadius = getZoneRadiusMeters(zone.center.latitude);

  return (
    <>
      {GRADIENT_RINGS.map((ring, index) => (
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
              {captain.captainUsername} ({captain.totalReps} reps)
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

const ZoneMap: React.FC<ZoneMapProps> = ({ userProfile }) => {
  const [captains, setCaptains] = useState<ZoneCaptain[]>([]);
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null);
  const [selectedZone, setSelectedZone] = useState<ZoneInfo | null>(null);
  const [standings, setStandings] = useState<ZoneStandings[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const userCoords = userProfile?.location?.coordinates;
  const hasLocation = userCoords && !(userCoords.latitude === 0 && userCoords.longitude === 0);

  const userZone = useMemo(() => {
    if (!hasLocation) return null;
    return getZoneFromCoordinates(
      userCoords.latitude,
      userCoords.longitude,
      userProfile?.location?.city
    );
  }, [hasLocation, userCoords, userProfile?.location?.city]);

  const mapCenter: [number, number] = hasLocation
    ? [userCoords.latitude, userCoords.longitude]
    : [40.7128, -74.006];

  const captainMap = useMemo(() => {
    const map = new Map<string, ZoneCaptain>();
    for (const captain of captains) {
      map.set(captain.zoneId, captain);
    }
    return map;
  }, [captains]);

  const claimedZonesInView = useMemo(() => {
    return captains
      .map((captain) => ({
        captain,
        zone: getZoneInfoFromId(captain.zoneId, userProfile?.location?.city),
      }))
      .filter(({ zone }) => {
        if (!mapBounds) return true;
        return mapBounds.contains([zone.center.latitude, zone.center.longitude]);
      });
  }, [captains, mapBounds, userProfile?.location?.city]);

  const loadCaptains = useCallback(async () => {
    setRefreshing(true);
    try {
      const [data, friends] = await Promise.all([
        fetchZoneCaptains(),
        userProfile?.id ? fetchFriendIds(userProfile.id) : Promise.resolve(new Set<string>()),
      ]);
      setCaptains(data);
      setFriendIds(friends);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userProfile?.id]);

  useEffect(() => {
    loadCaptains();
  }, [loadCaptains]);

  const handleBoundsChange = useCallback((bounds: L.LatLngBounds) => {
    setMapBounds(bounds);
  }, []);

  const handleZoneClick = useCallback(async (zone: ZoneInfo) => {
    setSelectedZone(zone);
    const data = await fetchZoneStandings(zone.id);
    setStandings(data);
  }, []);

  const uniqueCaptains = useMemo(() => {
    const seen = new Map<string, ZoneCaptain>();
    for (const captain of captains) {
      if (!seen.has(captain.captainUserId)) {
        seen.set(captain.captainUserId, captain);
      }
    }
    return Array.from(seen.values());
  }, [captains]);

  const legendItems = [
    { relation: "self" as const, label: "Your zones" },
    { relation: "friend" as const, label: "Friend zones" },
    { relation: "other" as const, label: "Other zones" },
  ];

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Territory Map</h1>
        <p className="text-gray-400">
          Claimed zones glow on the map —{" "}
          <span className="text-green-400">green</span> for you,{" "}
          <span className="text-blue-400">blue</span> for friends,{" "}
          <span className="text-red-400">red</span> for everyone else. Take over a zone for a{" "}
          <span className="text-yellow-400 font-semibold">Dice Heist!</span>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="relative rounded-xl overflow-hidden border border-gray-700 shadow-xl">
            {!hasLocation && (
              <div className="absolute top-3 left-3 right-3 z-[1000] bg-yellow-900/90 text-yellow-200 px-4 py-2 rounded-lg text-sm">
                Enable location access to see your zone on the map.
              </div>
            )}

            <button
              onClick={loadCaptains}
              disabled={refreshing}
              className="absolute top-3 left-3 z-[1000] bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-lg shadow-lg text-sm flex items-center gap-2 border border-gray-600 disabled:opacity-50">
              <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>

            <MapContainer
              center={mapCenter}
              zoom={hasLocation ? 14 : 4}
              className="h-[500px] w-full z-0"
              scrollWheelZoom>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapBoundsTracker onBoundsChange={handleBoundsChange} />
              {hasLocation && <RecenterButton center={mapCenter} />}

              {claimedZonesInView.map(({ zone, captain }) => (
                <ClaimedZoneCircle
                  key={zone.id}
                  zone={zone}
                  captain={captain}
                  color={getZoneColorForCaptain(
                    captain.captainUserId,
                    userProfile?.id || "",
                    friendIds
                  )}
                  isUserZone={userZone?.id === zone.id}
                  onSelect={handleZoneClick}
                />
              ))}
            </MapContainer>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
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
            {uniqueCaptains.length === 0 && !loading && (
              <span className="text-gray-500 text-sm">No zones claimed yet — be the first!</span>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {userZone && (
            <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <MapPin size={18} className="text-blue-400" />
                Your Zone
              </h2>
              <p className="text-gray-300 font-medium">{userZone.displayName}</p>
              {(() => {
                const captain = captainMap.get(userZone.id);
                if (captain?.captainUserId === userProfile?.id) {
                  return (
                    <p className="text-yellow-400 mt-2 flex items-center gap-1">
                      <Crown size={16} /> You're the Zone Captain! ({captain.totalReps} reps)
                    </p>
                  );
                }
                if (captain) {
                  return (
                    <p className="text-gray-400 mt-2">
                      Captain: <span className="text-white">{captain.captainUsername}</span> (
                      {captain.totalReps} reps)
                    </p>
                  );
                }
                return <p className="text-green-400 mt-2">Unclaimed — go claim it!</p>;
              })()}
            </div>
          )}

          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <h2 className="text-lg font-semibold text-white mb-3">
              {selectedZone ? selectedZone.displayName : "Zone Standings"}
            </h2>
            {!selectedZone && (
              <p className="text-gray-500 text-sm">Click a claimed zone on the map to see standings.</p>
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
                      index === 0
                        ? "bg-yellow-900/30 border border-yellow-700/50"
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

          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 text-sm text-gray-400">
            <h3 className="text-white font-semibold mb-2">How zones work</h3>
            <ul className="space-y-1.5 list-disc list-inside">
              <li>Zones are ~2km areas based on your location</li>
              <li>Only claimed zones appear on the map</li>
              <li>Every completed exercise adds reps to your current zone</li>
              <li>Captains are recalculated on a rolling 7-day window</li>
              <li>Overtake the captain to trigger a Dice Heist!</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ZoneMap;

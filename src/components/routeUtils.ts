// Utility functions & types split out from RouteApp

export interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
  name?: string;
  id?: string;
  displayNumber?: number; // <-- For custom map/legend numbering
}
export interface Waypoint {
  id: string;
  address: string;
  name?: string;
  coordinates?: [number, number];
  visited?: boolean;          // New: for marking as visited
  isEndPoint?: boolean;       // New: for marking the endpoint
}
export interface RouteData {
  distance: number;
  duration: number;
  coordinates: [number, number][];
  waypoints: LocationData[];
}

export function generateUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function formatDistance(distance: number) {
  if (distance < 1000) return `${Math.round(distance)} m`;
  return `${(distance / 1000).toFixed(1)} km`;
}
export function formatDuration(duration: number) {
  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// --- Geocode utility
export async function geocodeAddress(address: string): Promise<[number, number] | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
    );
    const data = await response.json();
    if (data && data.length > 0) {
      return [parseFloat(data[0].lon), parseFloat(data[0].lat)];
    }
    return null;
  } catch {
    return null;
  }
}

// --- OSRM route
export async function fetchOSRMRoute(
  mode: 'walking' | 'cycling' | 'driving',
  start: [number, number],
  destinations: { coords: [number, number], waypoint: Waypoint }[]
): Promise<{ geometry: [number, number][], distance: number, duration: number, waypoint_order?: number[] }> {
  // Correct OSRM profile mapping!
  const profileMap: Record<'walking' | 'cycling' | 'driving', string> = {
    walking: 'walking',
    cycling: 'cycling',
    driving: 'driving',
  };
  const profile = profileMap[mode] || 'driving';
  const waypoints = [start, ...destinations.map(d => d.coords)];
  const coordStr = waypoints.map(([lon, lat]) => `${lon},${lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/${profile}/${coordStr}?overview=full&geometries=geojson`;

  const resp = await fetch(url);
  const data = await resp.json();
  if (!data.routes || !data.routes[0]) {
    throw new Error("No road route found! One or more stops may be unreachable by the selected mode.");
  }
  const geometry: [number, number][] = data.routes[0].geometry.coordinates.map(([lon, lat]: [number, number]) => [lat, lon]);
  // Some OSRM endpoints have a 'waypoint_order' array for multi-stop optimization
  // It's in data.waypoints[*].waypoint_index, or for Trip API as data.trips[0].waypoint_order
  let waypoint_order: number[] | undefined;
  if (data.waypoints && Array.isArray(data.waypoints)) {
    waypoint_order = data.waypoints.map((wp: any) => wp.waypoint_index);
    // Remove the first (user location), which is always 0. Keep for just the stops.
    waypoint_order = waypoint_order.slice(1);
  }
  return {
    geometry,
    distance: data.routes[0].distance,
    duration: data.routes[0].duration,
    waypoint_order
  };
}

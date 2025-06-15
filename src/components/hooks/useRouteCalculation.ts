import { toast } from "@/hooks/use-toast";
import { geocodeAddress, fetchOSRMRoute, LocationData, Waypoint, RouteData } from "../routeUtils";

// --- New: OSRM trip endpoint fetch utility
async function fetchOSRMTripRoute(
  mode: 'walking' | 'cycling' | 'driving',
  start: [number, number],
  destinations: { coords: [number, number], waypoint: Waypoint }[],
  endCoords: [number, number] | null = null
): Promise<{
  geometry: [number, number][],
  distance: number,
  duration: number,
  waypoint_order: number[] | undefined,
  reordered: { coords: [number, number], waypoint: Waypoint }[]
}> {
  // Prepare coordinates: [start, ...stops, (optional endpoint)]
  const points = [start, ...destinations.map((d) => d.coords)];
  if (endCoords) points.push(endCoords);

  const profile = mode;
  const coordsStr = points.map(([lon, lat]) => `${lon},${lat}`).join(';');
  // Source is always first, destination is last if endCoords present
  const src = 0;
  const dst = endCoords ? points.length - 1 : 0;
  const url = `https://router.project-osrm.org/trip/v1/${profile}/${coordsStr}?overview=full&geometries=geojson&source=first${endCoords ? `&destination=last` : ''}`;

  const resp = await fetch(url);
  const data = await resp.json();
  if (!data.trips || !data.trips[0]) {
    console.log("OSRM trip API response (no trip):", data);
    throw new Error("Could not find an optimal trip for these destinations (possibly unreachable by selected mode).");
  }
  const { geometry, distance, duration, waypoint_order } = data.trips[0];

  if (!geometry || !geometry.coordinates || !Array.isArray(geometry.coordinates)) {
    console.log("OSRM trip API response (missing geometry):", data);
    throw new Error("Route data malformed: missing geometry.");
  }

  // If waypoint_order is missing, just use the input order for destinations
  let reordered: { coords: [number, number], waypoint: Waypoint }[] = [];
  if (destinations.length) {
    let order: number[] = [];
    if (Array.isArray(waypoint_order) && waypoint_order.length === destinations.length) {
      order = waypoint_order;
    } else {
      // Fallback: identity order for given destinations
      order = destinations.map((_, idx) => idx);
      if (!Array.isArray(waypoint_order)) {
        console.log(
          "OSRM trip API: waypoint_order missing or invalid for these destinations; falling back to input order.",
          { destinations, waypoint_order }
        );
      }
    }
    reordered = order.map(idx => {
      const dest = destinations[idx];
      if (!dest) {
        throw new Error(`Fallback: Waypoint order index ${idx} is out of range for destinations.`);
      }
      return {
        coords: dest.coords,
        waypoint: dest.waypoint
      };
    });
  }

  return {
    geometry: geometry.coordinates.map(([lon, lat]: [number, number]) => [lat, lon]),
    distance,
    duration,
    waypoint_order,
    reordered
  };
}

// --- Utility: Greedy insertion heuristic for multi-stop TSP-like routes
function calculateGreedyInsertionOrder(
  start: [number, number],
  waypoints: { coords: [number, number], waypoint: any }[],
  endCoords: [number, number] | null = null
) {
  if (waypoints.length === 0) return [];

  // Create a working copy so we don't modify the input
  let toInsert = [...waypoints];

  // Initial route is start → (optional end)
  let route: { coords: [number, number], waypoint: any }[] = [];

  if (endCoords) {
    // If user selects an endpoint, start with start → end and insert in between
    // Find the ending waypoint object as in nearest neighbor
    const endIdx = toInsert.findIndex(wp => wp.coords[0] === endCoords[0] && wp.coords[1] === endCoords[1]);
    let endpoint = null;
    if (endIdx !== -1) {
      endpoint = toInsert[endIdx];
      toInsert.splice(endIdx, 1);
      route = [
        { coords: start, waypoint: null }, // dummy for start
        { coords: endpoint.coords, waypoint: endpoint }
      ];
    } else {
      // No explicit endpoint found, treat as closed loop
      route = [
        { coords: start, waypoint: null },
        { coords: start, waypoint: null }
      ];
    }
  } else {
    // No explicit endpoint: treat as closed loop, start → start
    route = [
      { coords: start, waypoint: null },
      { coords: start, waypoint: null }
    ];
  }

  // Insert each waypoint at position that increases total distance the least
  while (toInsert.length) {
    let bestIncrease = Infinity;
    let bestIdx = -1;
    let bestPos = 1;
    for (let i = 0; i < toInsert.length; i++) {
      for (let pos = 1; pos < route.length; pos++) {
        const prev = route[pos - 1].coords;
        const next = route[pos].coords;
        const stop = toInsert[i].coords;
        const increase =
          haversine(prev, stop) + haversine(stop, next) - haversine(prev, next);
        if (increase < bestIncrease) {
          bestIncrease = increase;
          bestIdx = i;
          bestPos = pos;
        }
      }
    }
    // Insert the best waypoint at position
    route.splice(bestPos, 0, toInsert[bestIdx]);
    toInsert.splice(bestIdx, 1);
  }

  // Remove dummy start/end
  if (route[0].waypoint === null) route.shift();
  if (route.length && route[route.length - 1].waypoint === null) route.pop();
  return route;
}

// --- Utility: Compute Haversine distance between two coordinates
function haversine([lon1, lat1]: [number, number], [lon2, lat2]: [number, number]) {
  const R = 6371000; // meters
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// --- Utility: Nearest neighbor order given a start and waypoints
function calculateNearestNeighborOrder(
  start: [number, number],
  waypoints: { coords: [number, number], waypoint: any }[],
  endCoords: [number, number] | null = null
) {
  let ordered: typeof waypoints = [];
  let remaining = [...waypoints];

  // If an explicit endpoint, always save it for last
  let endpoint: typeof waypoints[0] | null = null;
  if (endCoords) {
    const idx = remaining.findIndex(wp => wp.coords[0] === endCoords[0] && wp.coords[1] === endCoords[1]);
    if (idx !== -1) {
      endpoint = remaining[idx];
      remaining.splice(idx, 1);
    }
  }

  let current = start;
  while (remaining.length > 0) {
    let minIdx = 0;
    let minDist = haversine(current, remaining[0].coords);
    for (let i = 1; i < remaining.length; i++) {
      const dist = haversine(current, remaining[i].coords);
      if (dist < minDist) {
        minIdx = i;
        minDist = dist;
      }
    }
    ordered.push(remaining[minIdx]);
    current = remaining[minIdx].coords;
    remaining.splice(minIdx, 1);
  }
  if (endpoint) ordered.push(endpoint);
  return ordered;
}

declare global {
  interface Window {
    __lastRouteDurationsByMode?: Record<string, number>;
  }
}

export function useRouteCalculation({
  currentLocation,
  leaflet,
  map,
  markersRef,
  routeLayerRef,
  transportMode,
}: {
  currentLocation: any;
  leaflet: any;
  map: any;
  markersRef: any;
  routeLayerRef: any;
  transportMode: "walking" | "cycling" | "driving";
}) {

  async function calculateMultiPointRoute(
    waypoints,
    setRouteData,
    setIsLoading
  ) {
    if (!currentLocation || !leaflet) {
      toast({
        title: "Missing information",
        description: "Please set your location first and wait for the map to load.",
        variant: "destructive",
      });
      return;
    }

    // Filter out visited waypoints
    const availableWaypoints = waypoints.filter((wp) =>
      !wp.visited && wp.address.trim() !== ""
    );
    if (availableWaypoints.length === 0) {
      toast({
        title: "No destinations",
        description: "Please add at least one unvisited destination.",
        variant: "destructive",
      });
      return;
    }

    // New: If only one, no need to optimize
    if (availableWaypoints.length === 1) {
      toast({
        title: "Only one destination",
        description: "Optimal route not needed for a single stop.",
      });
    }

    // Identify endpoint (optional)
    const endWaypointIndex = availableWaypoints.findIndex((wp) => wp.isEndPoint);
    let endWaypoint: typeof availableWaypoints[0] | null = null;
    let intermediateWaypoints = availableWaypoints;
    if (endWaypointIndex !== -1) {
      endWaypoint = availableWaypoints[endWaypointIndex];
      intermediateWaypoints = availableWaypoints.filter((_, i) => i !== endWaypointIndex);
    }

    setIsLoading(true);
    setRouteData(null);

    if (!window.__lastRouteDurationsByMode) window.__lastRouteDurationsByMode = {};
    const lastDurations = window.__lastRouteDurationsByMode;

    try {
      // Geocode all stops
      const geocodedIntermediate = [];
      for (const waypoint of intermediateWaypoints) {
        const coordinates = await geocodeAddress(waypoint.address);
        if (!coordinates) {
          throw new Error(`Destination "${waypoint.address}" not found`);
        }
        geocodedIntermediate.push({ ...waypoint, coordinates });
      }
      let geocodedEnd = null;
      let endCoords: [number, number] | null = null;
      if (endWaypoint) {
        const coordinates = await geocodeAddress(endWaypoint.address);
        if (!coordinates) {
          throw new Error(`End destination "${endWaypoint.address}" not found`);
        }
        geocodedEnd = { ...endWaypoint, coordinates };
        endCoords = geocodedEnd.coordinates!;
      }

      const startCoords: [number, number] = [
        currentLocation.longitude,
        currentLocation.latitude,
      ];

      // Prepare intermediate for trip API
      const intermediate = geocodedIntermediate.map(wp => ({
        coords: wp.coordinates!,
        waypoint: wp
      }));

      // Defensive
      if (!intermediate.length && !geocodedEnd) {
        throw new Error("No valid destinations to route to.");
      }

      // 1. Always use "driving" as the OSRM mode, regardless of transportMode for all route calculations
      let tripResp = null;
      let useGreedyInsertion = false;
      let useNearestNeighbor = false;
      try {
        tripResp = await fetchOSRMTripRoute(
          "driving", // <-- hardcoded
          startCoords,
          intermediate,
          endCoords
        );
        if (
          intermediate.length > 1 &&
          (!tripResp.waypoint_order || tripResp.waypoint_order.length !== intermediate.length)
        ) {
          useGreedyInsertion = true;
          toast({
            title: "Fast route calculated!",
            description:
              "Found a smart shortcut for your stops to save you time.",
          });
        }
      } catch {
        useGreedyInsertion = true;
        toast({
          title: "Fast route calculated!",
          description:
            "Found a smart shortcut for your stops to save you time.",
        });
      }

      // ------------ New: Nearest Neighbor (using real street routes) -------------
      let reordered;
      let geometryLatLngs = [];
      let totalDist = 0;
      let totalDur = 0;

      if (useGreedyInsertion) {
        let insertionInput = [...intermediate];
        if (endCoords) {
          insertionInput.push({ coords: endCoords, waypoint: geocodedEnd });
        }
        reordered = calculateGreedyInsertionOrder(startCoords, insertionInput, endCoords);

        let allCoords: [number, number][] = [];
        let prev = startCoords;
        for (let i = 0; i < reordered.length; i++) {
          const segStart = prev;
          const segEnd = reordered[i].coords;
          prev = segEnd;

          try {
            // Always use "driving" for fallback segments
            const segRoute = await fetchOSRMRoute(
              "driving", // <--- always use driving
              segStart,
              [{ coords: segEnd, waypoint: reordered[i].waypoint }]
            );
            if (allCoords.length > 0 && segRoute.geometry.length > 1) {
              allCoords.push(...segRoute.geometry.slice(1));
            } else {
              allCoords.push(...segRoute.geometry);
            }
            totalDist += segRoute.distance;
            totalDur += segRoute.duration;
          } catch (segErr) {
            allCoords.push([segEnd[1], segEnd[0]]);
            totalDist += haversine(segStart, segEnd);
            // Use car estimation for base, human adjustment below
            const speedMps = 13; // fallback car speed
            totalDur += haversine(segStart, segEnd) / speedMps;
          }
        }
        geometryLatLngs = allCoords.map(([lat, lon]) => [lat, lon]);
      } else if (useNearestNeighbor) {
        let nnInput = [...intermediate];
        if (endCoords) {
          nnInput.push({ coords: endCoords, waypoint: geocodedEnd });
        }
        reordered = calculateNearestNeighborOrder(startCoords, nnInput, endCoords);

        let allCoords: [number, number][] = [];
        let prev = startCoords;
        for (let i = 0; i < reordered.length; i++) {
          const segStart = prev;
          const segEnd = reordered[i].coords;
          prev = segEnd;

          try {
            const segRoute = await fetchOSRMRoute(
              "driving", // <--- always use car
              segStart,
              [{ coords: segEnd, waypoint: reordered[i].waypoint }]
            );
            if (allCoords.length > 0 && segRoute.geometry.length > 1) {
              allCoords.push(...segRoute.geometry.slice(1));
            } else {
              allCoords.push(...segRoute.geometry);
            }
            totalDist += segRoute.distance;
            totalDur += segRoute.duration;
          } catch (segErr) {
            allCoords.push([segEnd[1], segEnd[0]]);
            totalDist += haversine(segStart, segEnd);
            const speedMps = 13; // car
            totalDur += haversine(segStart, segEnd) / speedMps;
          }
        }
        geometryLatLngs = allCoords.map(([lat, lon]) => [lat, lon]);
      } else {
        reordered = tripResp.reordered;
        geometryLatLngs = tripResp.geometry.map(([lat, lon]) => [lat, lon]);
        totalDist = tripResp.distance;
        totalDur = tripResp.duration;
      }

      // 2. Multiply driving duration by factor for non-car modes
      let shownDuration = totalDur;
      if (transportMode === "walking") {
        shownDuration = totalDur * 3;
      } else if (transportMode === "cycling") {
        shownDuration = totalDur * 1.5;
      } // driving = base duration

      lastDurations[transportMode] = shownDuration;

      // Armado correcto de greedyWaypoints con endpoint -------------
      // reordered = arreglo de paradas intermedias (quizás sin el endpoint explícito...)

      // Armado:
      // Siempre agregamos el punto de inicio (ubicación actual), luego todos los puntos "reordered"
      // El último debe ser el endpoint si existe, y asignar correctamente su nombre/dirección

      // Si existe un endpoint, asegurarse de que **aparezca como último** en greedyWaypoints, con nombre y dirección
      let greedyWaypoints = [
        {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          address: currentLocation.address || "Your Location",
          name: "Your Location",
          id: "start",
          displayNumber: 0,
        },
        ...reordered.map((reorderedWp, idx) => {
          // Para el último punto, usaremos el nombre/dirección del endpoint si corresponde
          const esUltimo = idx === reordered.length - 1 && endWaypoint;
          return {
            latitude: reorderedWp.coords[1],
            longitude: reorderedWp.coords[0],
            address: esUltimo
              ? (
                  (endWaypoint?.address && endWaypoint.address.trim())
                    ? endWaypoint.address
                    : reorderedWp.waypoint.address
                )
              : reorderedWp.waypoint.address,
            name: esUltimo
              ? (
                  (endWaypoint?.name && endWaypoint.name.trim())
                    ? endWaypoint.name
                    : reorderedWp.waypoint.name
                )
              : reorderedWp.waypoint.name,
            id: esUltimo
              ? endWaypoint?.id || reorderedWp.waypoint.id
              : reorderedWp.waypoint.id,
            displayNumber: idx + 1,
          };
        }),
      ];

      // Map/Legend update + Polyline
      if (map.current) {
        if (routeLayerRef.current) {
          try { map.current.removeLayer(routeLayerRef.current); } catch { }
          routeLayerRef.current = null;
        }
        markersRef.current.forEach((marker) => {
          try { map.current.removeLayer(marker); } catch { }
        });
        markersRef.current = [];

        const routeCoords = geometryLatLngs;

        routeLayerRef.current = leaflet.polyline(routeCoords, {
          color:
            transportMode === "driving"
              ? "#3b82f6"
              : transportMode === "cycling"
                ? "#10b981"
                : "#f97316",
          weight: 6,
          opacity: 0.8,
        }).addTo(map.current);

        // Draw numbered markers in order
        greedyWaypoints.forEach((wp, idx) => {
          let color = "#4f46e5";
          if (wp.displayNumber === 0) color = "#2563eb";
          if (greedyWaypoints.length > 1 && idx === greedyWaypoints.length - 1) {
            color = "#000";
          }
          const numberHtml = `
            <div style="
              display: flex; align-items: center; justify-content: center;
              width: 30px; height: 30px;
              border-radius: 50%;
              font-weight: bold; font-size: 16px;
              color: #fff;
              background: ${color};
              border: 2.5px solid #fff;
              box-shadow: 0 1.5px 5px #0002;
            ">
              ${wp.displayNumber}
            </div>
          `;
          const icon = leaflet.divIcon({
            html: numberHtml,
            className: "",
            iconSize: [30, 30],
            iconAnchor: [15, 15],
            popupAnchor: [0, -18],
          });

          // Construcción del popup: mostrar nombre tal como lo ingresó el usuario (o dirección, si no), y coordenadas sin corchetes para el último punto
          let popupHtml = `<div style="font-weight:bold; font-size:1.1em;">
            <span style="display:inline-block; margin-right:6px; background:${color}; color:#fff; border-radius:50%; width:22px; height:22px; text-align:center; line-height:22px; font-size:15px;">
              ${wp.displayNumber}
            </span>
            ${
              wp.displayNumber === 0
                ? "Your Location"
                : (
                    // Si es el último punto, siempre mostrar el nombre ingresado (o dirección) y las coordenadas SIN corchetes
                    (idx === greedyWaypoints.length - 1)
                    ? `
                      ${(wp.name && wp.name.trim()) ? wp.name.trim() : (wp.address?.trim() || `Stop ${wp.displayNumber}`)}
                    `
                    : (wp.name && wp.name.trim())
                      ? wp.name.trim()
                      : wp.address?.split(",")[0] || `Stop ${wp.displayNumber}`
                  )
            }
          </div>`;
          if (idx === greedyWaypoints.length - 1 && (wp.latitude && wp.longitude)) {
            // Mostrar coordenadas SIN corchetes
            popupHtml += `<div style="font-size:0.85em; color:#666;"><span>${wp.latitude.toFixed(5)}, ${wp.longitude.toFixed(5)}</span></div>`;
          } else if (wp.displayNumber !== 0 && wp.address && idx !== greedyWaypoints.length - 1) {
            popupHtml += `<div style="font-size:0.85em; color:#666;">${wp.address}</div>`;
          }
          const marker = leaflet.marker([wp.latitude, wp.longitude], { icon });
          marker.bindPopup(popupHtml);
          markersRef.current.push(marker);
          marker.addTo(map.current!);
        });

        if (routeLayerRef.current) {
          map.current.fitBounds(routeLayerRef.current.getBounds(), {
            padding: [20, 20],
          });
        }
      }

      setRouteData({
        distance: totalDist,
        duration: shownDuration,
        coordinates: geometryLatLngs,
        waypoints: greedyWaypoints,
      });

      // Show a summary toast with stop order
      toast({
        title: useGreedyInsertion
          ? "Route: optimized by smart insertion"
          : useNearestNeighbor
            ? "Route: nearest neighbor order"
            : "Route calculated!",
        description: (greedyWaypoints.length > 1
          ? (
            "Stop sequence: " +
            greedyWaypoints
              .filter(wp => wp.displayNumber !== 0)
              // Para el último, nombre o dirección forzada
              .map((wp, idx, arr) => {
                if (idx === arr.length - 1) {
                  return (wp.name && wp.name.trim()) ?
                    wp.name.trim()
                    : (wp.address?.split(",")[0] || `Stop ${wp.displayNumber}`);
                } else {
                  return (wp.name && wp.name.trim()) ?
                    wp.name.trim()
                    : (wp.address?.split(",")[0] || `Stop ${wp.displayNumber}`);
                }
              })
              .join(" → ")
          )
          : endWaypoint
            ? `Optimal route with endpoint (${geocodedEnd?.name || geocodedEnd?.address}).`
            : `Optimal route with ${greedyWaypoints.length - 1} stop(s).`),
      });
    } catch (error) {
      console.error("Route calculation exception", error);
      toast({
        title: "Route calculation failed",
        description:
          error instanceof Error
            ? error.message
            : "Unable to calculate route.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return { calculateMultiPointRoute };
}

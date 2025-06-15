// Main composition logic split into subcomponents
import React, { useState, useEffect } from 'react';
import RouteLayout from './RouteLayout';
import RouteSidebar from './RouteSidebar';
import MapDisplay from './MapDisplay';
import { Waypoint, RouteData, generateUID } from './routeUtils';
import { useLeafletMap } from './hooks/useLeafletMap';
import { useCurrentLocation } from './hooks/useCurrentLocation';
import { useRouteCalculation } from './hooks/useRouteCalculation';
import { Route as RouteIcon, Car, Bike, Navigation } from "lucide-react";

const TRANSPORT_MODES = [
  { id: 'driving' as const, label: 'Car', icon: Car },
  { id: 'cycling' as const, label: 'Bike', icon: Bike },
  { id: 'walking' as const, label: 'Walking', icon: Navigation }
];

const WAYPOINTS_STORAGE_KEY = "lovable_saved_waypoints";

const RouteApp = () => {
  // Load waypoints from localStorage if present
  const loadWaypoints = (): Waypoint[] => {
    try {
      const saved = window.localStorage.getItem(WAYPOINTS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Defensive: Only accept as array with id/address
        if (Array.isArray(parsed) && parsed.every(wp => typeof wp.id === "string" && typeof wp.address === "string")) {
          return parsed;
        }
      }
    } catch {}
    return [{ id: generateUID(), address: "", name: "" }];
  };

  const {
    leaflet, setLeaflet,
    map, mapContainer,
    mapLoading, setMapLoading,
    mapError, setMapError,
    mapCardRef,
    controlPanelRef,
    markersRef,
    routeLayerRef
  } = useLeafletMap();

  const {
    currentLocation,
    setCurrentLocation,
    locationLoading,
    getCurrentLocation,
    lastUpdated
  } = useCurrentLocation();

  const [waypoints, setWaypoints] = useState<Waypoint[]>(loadWaypoints());
  const [transportMode, setTransportMode] = useState<"walking" | "cycling" | "driving">("driving");
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showLegend, setShowLegend] = useState(true);
  const [fileResetCounter, setFileResetCounter] = useState(0);

  const { calculateMultiPointRoute } = useRouteCalculation({
    currentLocation,
    leaflet,
    map,
    markersRef,
    routeLayerRef,
    transportMode,
  });

  // Save waypoints to localStorage whenever they change
  useEffect(() => {
    try {
      window.localStorage.setItem(WAYPOINTS_STORAGE_KEY, JSON.stringify(waypoints));
    } catch {}
  }, [waypoints]);

  // Add reset functionality here
  const handleResetApp = () => {
    setWaypoints([{ id: generateUID(), address: "", name: "" }]);
    setTransportMode("driving");
    setCurrentLocation(null);
    setRouteData(null);
    setShowLegend(true);
    setIsLoading(false);
    setMapError(null);
    setMapLoading(false);
    setFileResetCounter((c) => c + 1); // Incrementar el contador para reset de archivo
    // Remove waypoints from localStorage too
    try {
      window.localStorage.removeItem(WAYPOINTS_STORAGE_KEY);
    } catch {}
    // Remove map markers and route overlays
    if (map.current) {
      if (routeLayerRef.current) {
        try { map.current.removeLayer(routeLayerRef.current); } catch {}
        routeLayerRef.current = null;
      }
      markersRef.current.forEach((marker: any) => {
        try { map.current.removeLayer(marker); } catch {}
      });
      markersRef.current = [];
      // Optionally, reset map's view to default location (e.g., New York City)
      map.current.setView([40.7128, -74.006], 10);
    }
  };

  // Nuevo efecto: actualizar solo el marcador de ubicación actual y mover el mapa
  useEffect(() => {
    if (!leaflet || !map.current || !currentLocation) return;

    // Checar si ya existe el marcador 0 (ubicación del usuario)
    let userMarker = markersRef.current.find(m =>
      m.options?.lovableType === "currentLocation"
    );

    // Si existe, eliminarlo del mapa
    if (userMarker) {
      try {
        map.current.removeLayer(userMarker);
      } catch {}
      markersRef.current = markersRef.current.filter(
        m => m.options?.lovableType !== "currentLocation"
      );
    }

    // Crear nuevo marcador
    const L = leaflet; // asegúrate de que leaflet esté cargado
    const marker = L.marker([currentLocation.latitude, currentLocation.longitude], {
      title: "Tu ubicación",
      riseOnHover: true,
      lovableType: "currentLocation"
    });

    marker.addTo(map.current);
    marker.bindPopup("Tu ubicación actual");
    marker.setZIndexOffset(1000); // asegúrate que esté encima

    markersRef.current = [
      marker,
      ...markersRef.current // los otros marcadores ya existen y no son de ubicación
    ];

    // Pan/mapa a nueva ubicación
    map.current.setView([currentLocation.latitude, currentLocation.longitude], map.current.getZoom(), {
      animate: true,
      pan: { duration: 0.8 }
    });

    // No tocamos la capa de la ruta ni otros marcadores
  }, [currentLocation, leaflet, map, markersRef]);

  // Automatically recalculate route when transportMode changes
  React.useEffect(() => {
    // Only if there is a current location and at least one unvisited waypoint with address
    if (
      currentLocation &&
      waypoints.some((wp) => !wp.visited && wp.address.trim() !== "")
    ) {
      calculateMultiPointRoute(waypoints, setRouteData, setIsLoading);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transportMode]);
  
  return (
    <RouteLayout>
      <div className="w-full flex flex-col lg:grid lg:grid-cols-3 gap-6">
        <RouteSidebar
          waypoints={waypoints}
          setWaypoints={setWaypoints}
          onGetCurrentLocation={getCurrentLocation}
          locationLoading={locationLoading}
          currentLocation={currentLocation}
          transportMode={transportMode}
          setTransportMode={setTransportMode}
          showLegend={showLegend}
          setShowLegend={setShowLegend}
          onCalculateRoute={() =>
            calculateMultiPointRoute(waypoints, setRouteData, setIsLoading)
          }
          isLoading={isLoading}
          controlPanelRef={controlPanelRef}
          onResetApp={handleResetApp}
          lastUpdated={lastUpdated ? lastUpdated.toISOString() : null}
          resetFileUpload={fileResetCounter}
        />
        <div className="lg:col-span-2 relative order-1 lg:order-2 mb-4 lg:mb-0">
          <MapDisplay
            mapLoading={mapLoading}
            mapError={mapError}
            mapContainer={mapContainer}
            routeData={routeData}
            transportMode={transportMode}
            transportModes={TRANSPORT_MODES}
            mapCardRef={mapCardRef}
            showLegend={showLegend}
          />
        </div>
      </div>
    </RouteLayout>
  );
};

export default RouteApp;


import React, { useRef, useState, useCallback } from 'react';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Route as RouteIcon, Fullscreen } from "lucide-react";
import { formatDistance, formatDuration, LocationData, RouteData } from './routeUtils';

interface MapDisplayProps {
  mapLoading: boolean;
  mapError: string | null;
  mapContainer: React.RefObject<HTMLDivElement>;
  routeData: RouteData | null;
  transportMode: 'walking' | 'cycling' | 'driving';
  transportModes: { id: 'walking' | 'cycling' | 'driving', label: string, icon: React.ElementType }[];
  mapCardRef: React.RefObject<HTMLDivElement>;
  showLegend: boolean;
}

// Nueva función auxiliar para pantalla completa
function toggleFullscreen(element: HTMLElement | null) {
  if (!element) return;
  if (
    document.fullscreenElement === element ||
    (document as any).webkitFullscreenElement === element
  ) {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if ((document as any).webkitExitFullscreen) {
      (document as any).webkitExitFullscreen();
    }
  } else {
    if (element.requestFullscreen) {
      element.requestFullscreen();
    } else if ((element as any).webkitRequestFullscreen) {
      (element as any).webkitRequestFullscreen();
    }
  }
}

const MapDisplay: React.FC<MapDisplayProps> = ({
  mapLoading,
  mapError,
  mapContainer,
  routeData,
  transportMode,
  transportModes,
  mapCardRef,
  showLegend,
}) => {
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Mantén una referencia al div raíz para pantalla completa
  const rootCardRef = mapCardRef;

  // Actualiza el estado cuando cambia el fullscreen real del documento
  React.useEffect(() => {
    const handler = () => {
      if (!rootCardRef.current) return;
      const isFS =
        document.fullscreenElement === rootCardRef.current ||
        (document as any).webkitFullscreenElement === rootCardRef.current;
      setIsFullScreen(isFS);
    };

    document.addEventListener("fullscreenchange", handler);
    document.addEventListener("webkitfullscreenchange", handler);

    return () => {
      document.removeEventListener("fullscreenchange", handler);
      document.removeEventListener("webkitfullscreenchange", handler);
    };
  }, [rootCardRef]);

  const handleFullscreenClick = useCallback(() => {
    if (rootCardRef.current) {
      toggleFullscreen(rootCardRef.current);
    }
  }, [rootCardRef]);

  return (
    <Card ref={rootCardRef} className="relative h-full overflow-hidden lg:h-full transition-all">
      <CardContent className="p-0 h-full">
        {/* Botón de pantalla completa (ahora parte inferior izquierda) */}
        <button
          onClick={handleFullscreenClick}
          aria-label={isFullScreen ? "Cerrar pantalla completa" : "Ver mapa en pantalla completa"}
          className="absolute bottom-3 left-3 z-[1010] bg-white text-gray-700/80 hover:bg-gray-100 rounded-md shadow-lg p-2 border border-gray-200 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          type="button"
          style={{ lineHeight: 0 }}
        >
          <Fullscreen className="w-5 h-5" />
        </button>
        {mapLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg z-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading map...</p>
            </div>
          </div>
        )}
        {mapError && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-500/10 text-red-700 z-30">
            <div>
              <p className="font-bold">Map Error</p>
              <p>{mapError}</p>
            </div>
          </div>
        )}
        <div
          ref={mapContainer}
          className="w-full h-full min-h-[340px] max-h-none md:min-h-[360px] lg:min-h-0 rounded-lg z-10 bg-white transition-all"
          id="leaflet-map-main"
          style={{
            minHeight: "340px",
            height: "100%",
            maxHeight: "none",
          }}
        />
        {/* Route Legend Overlay, now controllable */}
        {routeData && showLegend && (
          <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-4 max-w-xs z-[1000]">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <RouteIcon className="w-4 h-4 text-blue-600" />
                Route Summary
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="text-center">
                  <div className="font-bold text-blue-600">
                    {formatDistance(routeData.distance)}
                  </div>
                  <div className="text-gray-500">Distance</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-green-600">
                    {formatDuration(routeData.duration)}
                  </div>
                  <div className="text-gray-500">Duration</div>
                </div>
              </div>
              <div className="flex items-center justify-center">
                <Badge variant="outline" className="flex items-center gap-1 text-xs">
                  {(() => {
                    const currentMode = transportModes.find((m) => m.id === transportMode);
                    if (currentMode) {
                      const IconComponent = currentMode.icon;
                      return <IconComponent className="w-3 h-3" />;
                    }
                    return null;
                  })()}
                  {transportModes.find((m) => m.id === transportMode)?.label}
                </Badge>
              </div>
              {/* Muestra correctamente el nombre del último punto */}
              {routeData.waypoints && routeData.waypoints.length > 0 && (
                <div className="border-t pt-2">
                  <div className="text-xs font-medium text-gray-700 mb-1">Stops:</div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {routeData.waypoints.map((wp, i) => {
                      const isFirst = wp.displayNumber === 0;
                      const isLast = i === routeData.waypoints.length - 1;
                      // Corregido: Todos los puntos muestran sólo el nombre/dirección, sin coordenadas
                      let stopLabel;
                      if (isFirst) {
                        stopLabel = "Your Location";
                      } else {
                        stopLabel = wp.name?.trim() || wp.address?.split(",")[0] || `Stop ${wp.displayNumber}`;
                      }
                      return (
                        <div key={wp.id ?? wp.displayNumber} className="text-xs text-gray-600 flex items-start gap-1">
                          <span
                            className="w-4 h-4 rounded-full text-white flex items-center justify-center text-xs font-semibold flex-shrink-0 mt-0.5 border-2 border-white"
                            style={{
                              background:
                                routeData.waypoints.length > 1 && isLast
                                  ? "#000"
                                  : isFirst
                                  ? "#2563eb"
                                  : "#4f46e5",
                            }}
                          >
                            {wp.displayNumber}
                          </span>
                          <span className="truncate">{stopLabel}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MapDisplay;


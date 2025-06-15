import { useEffect, useRef, useState } from "react";
import { toast } from "@/hooks/use-toast";

type UseLeafletMapResult = {
  leaflet: any;
  setLeaflet: React.Dispatch<any>;
  map: React.MutableRefObject<any>;
  mapContainer: React.RefObject<HTMLDivElement>;
  mapLoading: boolean;
  setMapLoading: React.Dispatch<React.SetStateAction<boolean>>;
  mapError: string | null;
  setMapError: React.Dispatch<React.SetStateAction<string | null>>;
  mapCardRef: React.RefObject<HTMLDivElement>;
  controlPanelRef: React.RefObject<HTMLDivElement>;
  markersRef: React.MutableRefObject<any[]>;
  routeLayerRef: React.MutableRefObject<any>;
};

export function useLeafletMap(): UseLeafletMapResult {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const routeLayerRef = useRef<any>(null);

  const [leaflet, setLeaflet] = useState<any>(null);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const mapCardRef = useRef<HTMLDivElement>(null);
  const controlPanelRef = useRef<HTMLDivElement>(null);

  // Map init
  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    setMapLoading(true);
    setMapError(null);
    (async () => {
      try {
        const L = await import('leaflet');
        if (!document.querySelector('link[href*="leaflet"]')) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
          link.crossOrigin = '';
          document.head.appendChild(link);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        const leaflet = L.default || L;
        if (leaflet.Icon && leaflet.Icon.Default) {
          delete (leaflet.Icon.Default.prototype as any)._getIconUrl;
          leaflet.Icon.Default.mergeOptions({
            iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
            iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
          });
        }
        const mapInstance = leaflet.map(mapContainer.current, {
          center: [40.7128, -74.006],
          zoom: 10,
          zoomControl: true,
          scrollWheelZoom: true,
          doubleClickZoom: true,
          touchZoom: true,
          preferCanvas: false
        });
        leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
          detectRetina: true
        }).addTo(mapInstance);
        map.current = mapInstance;
        setLeaflet(leaflet);
        setMapLoading(false);
        setMapError(null);
      } catch (error) {
        setMapLoading(false);
        setMapError("Map failed to load. Please refresh.");
        toast({
          title: "Map initialization failed",
          description: "Unable to load the map. Please refresh the page.",
          variant: "destructive"
        });
      }
    })();
    return () => {
      markersRef.current.forEach(marker => { try { map.current?.removeLayer(marker); } catch { } });
      if (routeLayerRef.current) { try { map.current?.removeLayer(routeLayerRef.current); } catch { } }
      try { map.current?.remove(); } catch { }
      map.current = null;
    };
  }, []);

  // Desktop map height sync
  useEffect(() => {
    function adjustMapHeight() {
      if (window.innerWidth >= 1024 && controlPanelRef.current && mapCardRef.current) {
        const sidebarHeight = controlPanelRef.current.offsetHeight;
        mapCardRef.current.style.height = sidebarHeight + 'px';
      } else if (mapCardRef.current) {
        mapCardRef.current.style.height = '';
      }
    }
    adjustMapHeight();
    window.addEventListener('resize', adjustMapHeight);
    return () => {
      window.removeEventListener('resize', adjustMapHeight);
    };
  }, []);

  return {
    leaflet, setLeaflet,
    map, mapContainer,
    mapLoading, setMapLoading,
    mapError, setMapError,
    mapCardRef,
    controlPanelRef,
    markersRef,
    routeLayerRef
  };
}

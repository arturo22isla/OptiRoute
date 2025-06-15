import { useState, useRef } from "react";
import { toast } from "@/hooks/use-toast";
import { LocationData } from "../routeUtils";

type UseCurrentLocation = () => {
  currentLocation: LocationData | null;
  setCurrentLocation: React.Dispatch<React.SetStateAction<LocationData | null>>;
  locationLoading: boolean;
  getCurrentLocation: () => void;
  lastUpdated: Date | null;
};

export const useCurrentLocation: UseCurrentLocation = () => {
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const locationInterval = useRef<number | null>(null);

  // Flag para mostrar el toast solo la primera actualización exitosa de ubicación (por sesión)
  const HAS_SHOWN_LOCATION_TOAST_KEY = "lovable_has_shown_location_toast";

  // Limpia el intervalo si el componente se desmonta o cuando inicias nueva búsqueda
  const clearLocationInterval = () => {
    if (locationInterval.current) {
      clearInterval(locationInterval.current);
      locationInterval.current = null;
    }
  };

  const fetchLocation = async () => {
    setLocationLoading(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
            );
            const data = await response.json();
            setCurrentLocation({
              latitude,
              longitude,
              address: data.display_name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
            });
          } catch (error) {
            setCurrentLocation({
              latitude,
              longitude,
              address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
            });
          }
          setLastUpdated(new Date());
          setLocationLoading(false);
          // Mostrar toast solo si no se ha mostrado en esta sesión
          if (typeof window !== "undefined" && !window.sessionStorage.getItem(HAS_SHOWN_LOCATION_TOAST_KEY)) {
            toast({
              title: "Location updated",
              description: "Your location has been updated.",
            });
            window.sessionStorage.setItem(HAS_SHOWN_LOCATION_TOAST_KEY, "1");
          }
        },
        (error) => {
          setLocationLoading(false);
          toast({
            title: "Location Error",
            description: "Unable to get your location. Check permissions.",
            variant: "destructive"
          });
        }
      );
    } else {
      setLocationLoading(false);
      toast({
        title: "Geolocation not supported",
        description: "Your browser does not support geolocation.",
        variant: "destructive"
      });
    }
  };

  const getCurrentLocation = () => {
    clearLocationInterval();
    fetchLocation();
    // Actualiza cada 1 minuto (60,000 ms)
    locationInterval.current = window.setInterval(() => {
      fetchLocation();
    }, 60000);
  };

  // Limpia el intervalo si se desmonta el componente
  // (esto previene llamadas cuando el usuario navega fuera)
  // Esto requiere un useEffect (no está permitido hooks aquí, pero asumimos esto es safe)
  if (typeof window !== "undefined") {
    // @ts-ignore
    if (!window.__LOCATION_UNLOADED__) {
      window.addEventListener("beforeunload", clearLocationInterval);
      // @ts-ignore
      window.__LOCATION_UNLOADED__ = true;
    }
  }

  return {
    currentLocation,
    setCurrentLocation,
    locationLoading,
    getCurrentLocation,
    lastUpdated,
  }
}

import React from "react";
import ControlsPanel from "./ControlsPanel";
import { Waypoint, generateUID } from "./routeUtils";
import * as XLSX from "xlsx";

type RouteSidebarProps = {
  waypoints: Waypoint[];
  setWaypoints: React.Dispatch<React.SetStateAction<Waypoint[]>>;
  onGetCurrentLocation: () => void;
  locationLoading: boolean;
  currentLocation: any;
  transportMode: "walking" | "cycling" | "driving";
  setTransportMode: (m: "walking" | "cycling" | "driving") => void;
  showLegend: boolean;
  setShowLegend: (v: boolean) => void;
  onCalculateRoute: () => void;
  isLoading: boolean;
  controlPanelRef: React.RefObject<HTMLDivElement>;
  onResetApp: () => void;
  lastUpdated: string | null; // <-- Add this
  resetFileUpload?: number; // <-- nuevo prop opcional
};

const RouteSidebar: React.FC<RouteSidebarProps> = ({
  waypoints,
  setWaypoints,
  onGetCurrentLocation,
  locationLoading,
  currentLocation,
  transportMode,
  setTransportMode,
  showLegend,
  setShowLegend,
  onCalculateRoute,
  isLoading,
  controlPanelRef,
  onResetApp,
  lastUpdated, // <-- Add this
  resetFileUpload
}) => {
  // Toggle visited status for waypoint
  const handleToggleVisited = (id: string) => {
    setWaypoints((wps) =>
      wps.map((wp) =>
        wp.id === id ? { ...wp, visited: !wp.visited } : wp
      )
    );
  };

  // Set endpoint (only one end point can be set)
  const handleSetEndPoint = (id: string) => {
    setWaypoints((wps) =>
      wps.map((wp) =>
        wp.id === id
          ? { ...wp, isEndPoint: true }
          : { ...wp, isEndPoint: false }
      )
    );
  };

  // Handles TXT/CSV and XLSX file import
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === "xlsx") {
      // process XLSX with xlsx package
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target?.result;
        if (!data) return;
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        // json: Array of arrays, each array = row
        // Try to be flexible: first row is header only if text fields
        const rows = (json as Array<any[]>)
          .slice(Array.isArray(json[0]) && typeof json[0][0] === "string" && typeof json[0][1] === "string" ? 1 : 0)
          .filter((row) => (row[0] || row[1]));
        const newWaypoints: Waypoint[] = rows.map((row) => {
          // If 2 columns: [name, address], else just address
          let name = "";
          let address = "";
          if (row.length >= 2) {
            name = String(row[0] || "").trim();
            address = String(row[1] || "").trim();
          } else if (row.length === 1) {
            address = String(row[0] || "").trim();
          }
          return {
            id: generateUID(),
            address,
            name,
            visited: false,
            isEndPoint: false,
          };
        }).filter(wp => wp.address);
        if (newWaypoints.length) setWaypoints(newWaypoints);
      };
      reader.readAsArrayBuffer(file);
    } else {
      // process as txt/csv
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const lines = text
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length > 0);
        const newWaypoints: Waypoint[] = lines
          .map((line) => {
            let name = "";
            let address = "";
            const firstComma = line.indexOf(",");
            if (firstComma !== -1) {
              name = line.substring(0, firstComma).trim();
              address = line.substring(firstComma + 1).trim();
            } else {
              address = line.trim();
            }
            return {
              id: generateUID(),
              address,
              name,
              visited: false,
              isEndPoint: false
            };
          })
          .filter((wp) => wp.address);
        if (newWaypoints.length) setWaypoints(newWaypoints);
      };
      reader.readAsText(file);
    }
    event.target.value = "";
  };

  return (
    <div ref={controlPanelRef} className="lg:col-span-1 z-20 order-2 lg:order-1">
      <ControlsPanel
        waypoints={waypoints}
        setWaypoints={setWaypoints}
        onAddWaypoint={() =>
          setWaypoints((prev) => [
            ...prev,
            { id: generateUID(), address: "", name: "" },
          ])
        }
        onRemoveWaypoint={(id: string) => {
          if (waypoints.length > 1)
            setWaypoints((wps) => wps.filter((wp) => wp.id !== id));
        }}
        onUpdateWaypoint={(id: string, value: string, field: "address" | "name") =>
          setWaypoints((wps) =>
            wps.map((wp) => (wp.id === id ? { ...wp, [field]: value } : wp))
          )
        }
        getCurrentLocation={onGetCurrentLocation}
        locationLoading={locationLoading}
        currentLocation={currentLocation}
        onFileUpload={handleFileUpload}
        transportMode={transportMode}
        setTransportMode={setTransportMode}
        showLegend={showLegend}
        setShowLegend={setShowLegend}
        onCalculateRoute={onCalculateRoute}
        isLoading={isLoading}
        onResetApp={onResetApp}
        onToggleVisited={handleToggleVisited}
        onSetEndPoint={handleSetEndPoint}
        lastUpdated={lastUpdated}
        resetFileUpload={resetFileUpload}
      />
    </div>
  );
};

export default RouteSidebar;

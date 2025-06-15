import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Eye, EyeOff, MapPin, Navigation, Bike, Car, RotateCcw, Check } from 'lucide-react';
import { Waypoint } from './routeUtils';
import WaypointInput from "./WaypointInput";

type ControlsProps = {
  waypoints: Waypoint[];
  setWaypoints: React.Dispatch<React.SetStateAction<Waypoint[]>>;
  onAddWaypoint: () => void;
  onRemoveWaypoint: (id: string) => void;
  onUpdateWaypoint: (id: string, value: string, field: 'address' | 'name') => void;
  getCurrentLocation: () => void;
  locationLoading: boolean;
  currentLocation: { address?: string; latitude?: number; longitude?: number } | null;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  transportMode: 'walking' | 'cycling' | 'driving';
  setTransportMode: (m: 'walking' | 'cycling' | 'driving') => void;
  showLegend: boolean;
  setShowLegend: (v: boolean) => void;
  onCalculateRoute: () => void;
  isLoading: boolean;
  onResetApp?: () => void;
  onToggleVisited?: (id: string) => void;
  onSetEndPoint?: (id: string) => void;
  lastUpdated: string | null;
  resetFileUpload?: number;
};

const transportModes = [
  { id: 'driving' as const, label: 'Car', icon: Car },
  { id: 'cycling' as const, label: 'Bike', icon: Bike },
  { id: 'walking' as const, label: 'Walking', icon: Navigation }
];

const ControlsPanel: React.FC<ControlsProps> = ({
  waypoints,
  setWaypoints,
  onAddWaypoint,
  onRemoveWaypoint,
  onUpdateWaypoint,
  getCurrentLocation,
  locationLoading,
  currentLocation,
  onFileUpload,
  transportMode,
  setTransportMode,
  showLegend,
  setShowLegend,
  onCalculateRoute,
  isLoading,
  onResetApp,
  onToggleVisited,
  onSetEndPoint,
  lastUpdated,
  resetFileUpload
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>("");

  // Limpiar el archivo si se activa resetFileUpload
  useEffect(() => {
    setFileName("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [resetFileUpload]);

  // Toggle upload/manual input mode
  const [inputMode, setInputMode] = useState<'file' | 'manual'>('manual');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFileName(e.target.files[0].name);
    } else {
      setFileName("");
    }
    onFileUpload(e);
  };

  // Find endpoint to display its name if available
  const endpoint = waypoints.find(wp => wp.isEndPoint);

  // Mostrar la hora de la última actualización si existe (traducimos el label)
  const renderLastUpdate = () => {
    if (!lastUpdated) return null;
    // Format: HH:mm:ss
    const date = new Date(lastUpdated);
    const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return (
      <p className="text-xs text-gray-500 mt-1">
        Last updated: {timeString}
      </p>
    );
  };

  return (
    <div className="space-y-6 relative pb-3">
      {/* Reset button, moved top left, max-w full, Z-30 */}
      {onResetApp && (
        <div className="w-full flex justify-end mb-2">
          <Button
            onClick={onResetApp}
            variant="link"
            size="sm"
            className="text-xs text-red-600 hover:text-red-700 font-semibold p-0 h-auto min-w-[unset] flex items-center gap-1 z-30"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </Button>
        </div>
      )}

      {/* INPUT MODE SELECTOR */}
      <div className="flex gap-2 justify-center my-2">
        <Button
          variant={inputMode === 'file' ? 'default' : 'outline'}
          className="flex-1"
          onClick={() => setInputMode('file')}
        >
          Upload File
        </Button>
        <Button
          variant={inputMode === 'manual' ? 'default' : 'outline'}
          className="flex-1"
          onClick={() => setInputMode('manual')}
        >
          Select Destinations Manually
        </Button>
      </div>

      {/* Show the corresponding section based on selection */}
      {inputMode === 'file' && (
        <div>
          <label className="block mb-2 text-sm font-medium text-gray-700">Upload File</label>
          <div>
            <input
              ref={fileInputRef}
              id="file-upload"
              type="file"
              accept=".csv, .txt, .xlsx"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="bg-black text-white font-semibold px-4 py-2 rounded-full border-0 text-sm mb-1"
            >
              Choose File
            </button>
            <span className="ml-2 text-xs text-gray-600 align-middle">
              {fileName ? fileName : "No files selected"}
            </span>
          </div>
          {/* Show endpoint name if present */}
          {endpoint && endpoint.name && (
            <div className="mt-2 text-xs text-blue-900">
              <strong>Selected End Point:</strong> {endpoint.name}
            </div>
          )}

          {/* File structure help */}
          <div className="mt-3 bg-blue-50 border border-blue-200 text-blue-900 text-xs rounded-lg p-3">
            <strong>File format example:</strong>
            <div className="mt-1 font-mono text-xs bg-blue-100 rounded px-2 py-1 mb-1">
              Name,Address,End<br />
              Home,221B Baker Street London,No<br />
              Office,5th Ave New York,No<br />
              Central Park,"40.785091 -73.968285",Yes
            </div>
            <span>
              <b>Accepted file types:</b> CSV, TXT, XLSX.<br />
              The file should have the following columns:<br />
              <b>Name</b> (name of the stop), <b>Address</b> (address or coordinates in quotes), <b>End</b> ("Yes" or "No", indicating which is the final stop).<br />
              <u>Example:</u><br />
              <span className="font-mono">
                Name,Address,End<br />
                Home,"51.5074 -0.1278",No<br />
                Office,"40.7128 -74.0060",No<br />
                LastStop,"48.8584 2.2945",Yes
              </span>
            </span>
          </div>

          {/* Get Current Location (both modes) */}
          <div className="p-4 bg-white rounded-lg shadow-sm mt-4 mb-2">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-5 h-5" />
              <span className="font-semibold">Your location</span>
            </div>
            <Button onClick={getCurrentLocation} disabled={locationLoading} className="w-full">
              {locationLoading ? 'Detecting...' : 'Get current location'}
            </Button>
            {currentLocation && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg mt-3">
                <p className="text-sm font-medium text-green-800">Location found</p>
                {currentLocation.address && (
                  <p className="text-xs text-green-600 mt-1">{currentLocation.address}</p>
                )}
                {typeof currentLocation.latitude === 'number' && typeof currentLocation.longitude === 'number' && (
                  <p className="text-xs text-green-600">
                    {currentLocation.latitude!.toFixed(4)}, {currentLocation.longitude!.toFixed(4)}
                  </p>
                )}
                {renderLastUpdate()}
              </div>
            )}
          </div>
        </div>
      )}

      {inputMode === 'manual' && (
        <>
          <div className="p-4 bg-white rounded-lg shadow-sm mb-2">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-5 h-5" />
              <span className="font-semibold">Your location</span>
            </div>
            <Button onClick={getCurrentLocation} disabled={locationLoading} className="w-full">
              {locationLoading ? 'Detecting...' : 'Get current location'}
            </Button>
            {currentLocation && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg mt-3">
                <p className="text-sm font-medium text-green-800">Location found</p>
                {currentLocation.address && (
                  <p className="text-xs text-green-600 mt-1">{currentLocation.address}</p>
                )}
                {typeof currentLocation.latitude === 'number' && typeof currentLocation.longitude === 'number' && (
                  <p className="text-xs text-green-600">
                    {currentLocation.latitude!.toFixed(4)}, {currentLocation.longitude!.toFixed(4)}
                  </p>
                )}
                {renderLastUpdate()}
              </div>
            )}
          </div>
          {/* Waypoints */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-3 block">
              Destinations
            </label>
            <div className="space-y-2">
              {waypoints.map((waypoint, index) => (
                <div className="flex items-center gap-2" key={waypoint.id}>
                  {/* Visited checkbox */}
                  <button
                    className={`rounded-full border-2 w-6 h-6 flex items-center justify-center mr-1 ${waypoint.visited ? "bg-green-500 border-green-700 text-white" : "border-gray-300 bg-white text-gray-400"}`}
                    type="button"
                    aria-label={waypoint.visited ? "Mark as unvisited" : "Mark as visited"}
                    title={waypoint.visited ? "Visited" : "Mark as visited"}
                    onClick={() => onToggleVisited?.(waypoint.id)}
                  >
                    {waypoint.visited && <Check className="w-4 h-4" />}
                  </button>
                  <div className="flex-1">
                    <WaypointInput
                      waypoint={waypoint}
                      index={index}
                      canRemove={waypoints.length > 1}
                      onRemove={onRemoveWaypoint}
                      onUpdate={onUpdateWaypoint}
                    />
                  </div>
                  {/* End-point selector */}
                  <button
                    className={`rounded-lg px-2 py-1 border text-xs font-semibold ml-1 ${waypoint.isEndPoint ? "bg-blue-600 text-white border-blue-700" : "border-gray-300 bg-white text-gray-400"}`}
                    type="button"
                    aria-label="Set as end point"
                    title={waypoint.isEndPoint ? "End Point" : "Set as end point"}
                    onClick={() => onSetEndPoint?.(waypoint.id)}
                  >
                    {waypoint.isEndPoint ? "END" : "Set End"}
                  </button>
                </div>
              ))}
              <Button
                variant="outline"
                onClick={onAddWaypoint}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Destination
              </Button>
            </div>
            <div className="text-xs text-gray-400 mt-1">
              <span>✔️ Mark sites visited to skip them in recalculation. Choose any destination as the End Point.</span>
            </div>
          </div>
        </>
      )}

      {/* Transport */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-3 block">
          Transportation Mode
        </label>
        <div className="grid grid-cols-3 gap-2">
          {transportModes.map((mode) => (
            <Button
              key={mode.id}
              variant={transportMode === mode.id ? "default" : "outline"}
              size="sm"
              onClick={() => setTransportMode(mode.id)}
              className="flex flex-col items-center p-3 h-auto"
            >
              <mode.icon className="w-4 h-4 mb-1" />
              <span className="text-xs">{mode.label}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Map Options */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-3 block">
          Map Options
        </label>
        <Button
          variant={showLegend ? "default" : "outline"}
          size="sm"
          onClick={() => setShowLegend(!showLegend)}
          className="w-full flex items-center justify-center gap-2 mt-2"
        >
          {showLegend ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          {showLegend ? "Hide Legend" : "Show Legend"}
        </Button>
      </div>

      {/* Highlighted calculate button */}
      <Button
        onClick={onCalculateRoute}
        disabled={isLoading}
        className="w-full py-4 text-lg font-bold bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-400 text-white shadow-lg hover:from-blue-700 hover:to-cyan-500 transition-all border-2 border-blue-700"
        style={{
          minHeight: "3rem",
        }}
      >
        {isLoading ? "Calculating..." : "Calculate Optimal Route"}
      </Button>
    </div>
  );
};

export default ControlsPanel;


import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

type WaypointInputProps = {
  waypoint: {
    id: string;
    address: string;
    name?: string;
  };
  index: number;
  canRemove: boolean;
  onRemove: (id: string) => void;
  onUpdate: (id: string, value: string, field: "address" | "name") => void;
};

const WaypointInput: React.FC<WaypointInputProps> = React.memo(
  ({ waypoint, index, canRemove, onRemove, onUpdate }) => {
    const [address, setAddress] = useState(waypoint.address ?? "");
    const [name, setName] = useState(waypoint.name ?? "");

    // Only update local state when waypoint changes (not every keystroke)
    useEffect(() => {
      setAddress(waypoint.address ?? "");
    }, [waypoint.address]);
    useEffect(() => {
      setName(waypoint.name ?? "");
    }, [waypoint.name]);

    // Blur handlers to only call parent on major edit
    const handleAddressBlur = () => {
      if (address !== (waypoint.address ?? "")) {
        onUpdate(waypoint.id, address, "address");
      }
    };
    const handleNameBlur = () => {
      if (name !== (waypoint.name ?? "")) {
        onUpdate(waypoint.id, name, "name");
      }
    };

    return (
      <div className="flex flex-col gap-1 mb-2 border-b pb-2 border-gray-100 relative">
        <div className="flex gap-2 items-center">
          <Input
            type="text"
            placeholder={`Destination ${index + 1} Address`}
            value={address}
            onChange={e => setAddress(e.target.value)}
            onBlur={handleAddressBlur}
            className="flex-1"
            autoComplete="off"
            spellCheck={false}
          />
          {canRemove && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRemove(waypoint.id)}
              tabIndex={-1}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        <Input
          type="text"
          placeholder={`Point ${index + 1} Name (optional)`}
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={handleNameBlur}
          className="mt-1 text-xs"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
    );
  }
);

export default WaypointInput;

"use client";

import { LucideIcon } from "lucide-react";
import MapPlaceholder from "@/components/MapPlaceholder";
import { LocationPin, VehicleMarker } from "@/components/MapPin";
import { driverPositionFor } from "@/lib/rides/geometry";
import { ActiveRide } from "@/lib/types";

export default function RideMap({ ride, now, icon: Icon }: { ride: ActiveRide; now: number; icon: LucideIcon }) {
  const driverPos = driverPositionFor(ride, now);

  return (
    <MapPlaceholder className="relative mt-3 flex-1">
      {ride.phase === "searching" && (
        <>
          <span
            className="voice-ring absolute"
            style={{ left: `${ride.pickupPoint.x}%`, top: `${ride.pickupPoint.y}%`, width: 60, height: 60, marginLeft: -30, marginTop: -30 }}
          />
          <span
            className="voice-ring absolute"
            style={{
              left: `${ride.pickupPoint.x}%`,
              top: `${ride.pickupPoint.y}%`,
              width: 60,
              height: 60,
              marginLeft: -30,
              marginTop: -30,
              animationDelay: "0.6s",
            }}
          />
        </>
      )}

      <svg className="pointer-events-none absolute inset-0 h-full w-full">
        <line
          x1={`${ride.pickupPoint.x}%`}
          y1={`${ride.pickupPoint.y}%`}
          x2={`${ride.dropPoint.x}%`}
          y2={`${ride.dropPoint.y}%`}
          stroke="#1a1508"
          strokeOpacity={0.25}
          strokeWidth={2}
          strokeDasharray="6 6"
        />
      </svg>

      <LocationPin x={ride.pickupPoint.x} y={ride.pickupPoint.y} kind="pickup" />
      <LocationPin x={ride.dropPoint.x} y={ride.dropPoint.y} kind="drop" />
      {ride.driver && ride.phase !== "searching" && <VehicleMarker x={driverPos.x} y={driverPos.y} icon={Icon} animate />}
    </MapPlaceholder>
  );
}

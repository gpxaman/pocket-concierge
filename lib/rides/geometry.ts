// Pure math for placing the driver marker on the demo map — no store or
// React dependency, so this is directly unit-testable.
import { ActiveRide, MapPoint } from "@/lib/types";

export function hashToUnit(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Deterministic (not Math.random) driver spawn point near pickup — same on every render for a given ride id. */
export function spawnPointFor(ride: ActiveRide): MapPoint {
  const angle = hashToUnit(ride.id) * Math.PI * 2;
  const radius = 15 + hashToUnit(`${ride.id}-r`) * 15;
  return {
    x: Math.min(92, Math.max(8, ride.pickupPoint.x + radius * Math.cos(angle))),
    y: Math.min(88, Math.max(16, ride.pickupPoint.y + radius * Math.sin(angle))),
  };
}

export function driverPositionFor(ride: ActiveRide, now: number): MapPoint {
  const spawn = spawnPointFor(ride);
  switch (ride.phase) {
    case "driver_assigned":
      return spawn;
    case "en_route_to_pickup": {
      if (!ride.matchedAt || !ride.pickupEtaAt) return spawn;
      const t = Math.min(1, Math.max(0, (now - ride.matchedAt) / (ride.pickupEtaAt - ride.matchedAt)));
      return { x: lerp(spawn.x, ride.pickupPoint.x, t), y: lerp(spawn.y, ride.pickupPoint.y, t) };
    }
    case "driver_arrived":
      return ride.pickupPoint;
    case "in_progress": {
      if (!ride.tripStartedAt || !ride.tripEtaAt) return ride.pickupPoint;
      const t = Math.min(1, Math.max(0, (now - ride.tripStartedAt) / (ride.tripEtaAt - ride.tripStartedAt)));
      return { x: lerp(ride.pickupPoint.x, ride.dropPoint.x, t), y: lerp(ride.pickupPoint.y, ride.dropPoint.y, t) };
    }
    case "completed":
      return ride.dropPoint;
    default:
      return spawn;
  }
}

// Cab-booking live-tracking domain (Uber/Ola-style). `ActiveRide` is the
// single source of truth the simulation engine (lib/rides/useRideMatching)
// and the tracking UI both read/write — every timestamp is nullable and
// filled in as the ride progresses through `RidePhase`.

import type { Driver } from "@/lib/data/drivers";
import type { PaymentSource } from "./transactions";

export type RidePhase =
  | "searching"
  | "driver_assigned"
  | "en_route_to_pickup"
  | "driver_arrived"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface MapPoint {
  x: number;
  y: number;
}

export interface ActiveRide {
  id: string;
  transactionId: string;
  phase: RidePhase;
  rideTypeId: string;
  rideTypeLabel: string;
  pickup: string;
  drop: string;
  pickupPoint: MapPoint;
  dropPoint: MapPoint;
  distanceKm: number;
  fare: number;
  source: PaymentSource;
  driver: Driver | null;
  driverDistanceKm: number | null;
  otp: string | null;
  requestedAt: number;
  searchDeadlineAt: number | null;
  matchedAt: number | null;
  pickupEtaAt: number | null;
  arrivedAt: number | null;
  tripStartedAt: number | null;
  tripEtaAt: number | null;
  completedAt: number | null;
  cancelledAt: number | null;
  driverRatingGiven: number | null;
  triedDriverNames: string[];
}

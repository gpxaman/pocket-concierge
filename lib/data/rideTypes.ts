import { Bike, CarFront, Car, CarTaxiFront, LucideIcon } from "lucide-react";

export interface RideType {
  id: string;
  label: string;
  subtitle: string;
  seats: number;
  baseFare: number;
  perKm: number;
  /** Pickup ETA in minutes, not trip duration. */
  etaMinutes: number;
}

// Fares are base + per-km, not looked up from the catalog (see lib/pricing.ts's
// priceRide) — modeled loosely on Rapido (bike, cheapest/fastest) and Uber/
// Ola-style cab tiers (standard/premium), per the researched UX.
export const RIDE_TYPES: RideType[] = [
  { id: "bike", label: "Bike", subtitle: "1 seat · fastest & cheapest", seats: 1, baseFare: 15, perKm: 6, etaMinutes: 3 },
  { id: "auto", label: "Auto", subtitle: "3 seats · open-air", seats: 3, baseFare: 25, perKm: 9, etaMinutes: 4 },
  { id: "standard", label: "Standard Cab", subtitle: "4 seats · AC sedan", seats: 4, baseFare: 40, perKm: 12, etaMinutes: 5 },
  { id: "premium", label: "Premium Cab", subtitle: "4 seats · AC · top-rated drivers", seats: 4, baseFare: 60, perKm: 18, etaMinutes: 5 },
];

export const RIDE_TYPE_ICON: Record<string, LucideIcon> = {
  bike: Bike,
  auto: CarFront,
  standard: Car,
  premium: CarTaxiFront,
};

export function findRideType(id: string): RideType | undefined {
  return RIDE_TYPES.find((r) => r.id === id);
}

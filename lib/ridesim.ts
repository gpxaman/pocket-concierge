import { Driver, driversForType } from "@/lib/data/drivers";

/** How long the app searches for a driver before giving up. */
export const SEARCH_BUDGET_MS = 15_000;
/** How long a single offer sits with a driver before we treat it as timed out. */
export const OFFER_TIMEOUT_MS = 3_000;

export interface MatchCandidate {
  driver: Driver;
  simulatedDistanceKm: number;
  score: number;
}

/** Higher is better: closer, better-rated, more likely to accept. */
export function scoreDriver(driver: Driver, simulatedDistanceKm: number): number {
  return driver.rating * 2 - simulatedDistanceKm * 1.5 + driver.acceptanceRate * 3;
}

/**
 * Nearby-driver pool for a vehicle type, minus anyone already tried this
 * search. Drivers have no persistent map position in this prototype, so a
 * plausible "nearby" distance is fabricated per call — call this only from
 * an effect/handler, never during render.
 */
export function candidatesFor(rideTypeId: string, excludeNames: string[]): MatchCandidate[] {
  return driversForType(rideTypeId)
    .filter((d) => !excludeNames.includes(d.name))
    .map((driver) => {
      const simulatedDistanceKm = Math.round((0.4 + Math.random() * 3.5) * 10) / 10;
      return { driver, simulatedDistanceKm, score: scoreDriver(driver, simulatedDistanceKm) };
    })
    .sort((a, b) => b.score - a.score);
}

/** Whether a driver accepts a given offer — call only from an effect/handler. */
export function resolveOffer(driver: Driver): boolean {
  return Math.random() < driver.acceptanceRate;
}

/** Minutes for a driver to reach the pickup point (short hop, not the trip itself). */
export function pickupEtaMinutes(driverDistanceKm: number): number {
  return Math.max(2, Math.round((driverDistanceKm / 20) * 60 + Math.random() * 2));
}

/** Trip duration at a mock average city speed of ~24 km/h. */
export function tripDurationMinutes(distanceKm: number): number {
  return Math.max(3, Math.round((distanceKm / 24) * 60));
}

export function generateOtp(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

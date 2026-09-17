import { describe, expect, it } from "vitest";
import { driverPositionFor, hashToUnit, lerp, spawnPointFor } from "@/lib/rides/geometry";
import { ActiveRide } from "@/lib/types";

function makeRide(overrides: Partial<ActiveRide>): ActiveRide {
  return {
    id: "ride-1",
    transactionId: "tx-1",
    phase: "driver_assigned",
    rideTypeId: "bike",
    rideTypeLabel: "Bike",
    pickup: "Pickup St",
    drop: "Drop Ave",
    pickupPoint: { x: 20, y: 30 },
    dropPoint: { x: 80, y: 70 },
    distanceKm: 5,
    fare: 100,
    source: "wallet",
    driver: null,
    driverDistanceKm: null,
    otp: null,
    requestedAt: 0,
    searchDeadlineAt: null,
    matchedAt: null,
    pickupEtaAt: null,
    arrivedAt: null,
    tripStartedAt: null,
    tripEtaAt: null,
    completedAt: null,
    cancelledAt: null,
    driverRatingGiven: null,
    triedDriverNames: [],
    ...overrides,
  };
}

describe("hashToUnit", () => {
  it("is deterministic for the same id", () => {
    expect(hashToUnit("ride-1")).toBe(hashToUnit("ride-1"));
  });

  it("returns a value in [0, 1)", () => {
    const v = hashToUnit("some-ride-id");
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });

  it("differs across different ids (not a constant function)", () => {
    expect(hashToUnit("ride-a")).not.toBe(hashToUnit("ride-b"));
  });
});

describe("lerp", () => {
  it("interpolates linearly between two values", () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(0, 10, 0.5)).toBe(5);
  });
});

describe("spawnPointFor", () => {
  it("is deterministic for the same ride id", () => {
    const ride = makeRide({});
    expect(spawnPointFor(ride)).toEqual(spawnPointFor(ride));
  });

  it("clamps within the map bounds", () => {
    const ride = makeRide({ pickupPoint: { x: 2, y: 2 } });
    const spawn = spawnPointFor(ride);
    expect(spawn.x).toBeGreaterThanOrEqual(8);
    expect(spawn.x).toBeLessThanOrEqual(92);
    expect(spawn.y).toBeGreaterThanOrEqual(16);
    expect(spawn.y).toBeLessThanOrEqual(88);
  });
});

describe("driverPositionFor", () => {
  it("places the driver at the spawn point while driver_assigned", () => {
    const ride = makeRide({ phase: "driver_assigned" });
    expect(driverPositionFor(ride, Date.now())).toEqual(spawnPointFor(ride));
  });

  it("interpolates from spawn to pickup partway through en_route_to_pickup", () => {
    const ride = makeRide({ phase: "en_route_to_pickup", matchedAt: 1000, pickupEtaAt: 2000 });
    const spawn = spawnPointFor(ride);
    const start = driverPositionFor(ride, 1000);
    const mid = driverPositionFor(ride, 1500);
    const end = driverPositionFor(ride, 2000);
    expect(start).toEqual(spawn);
    expect(end).toEqual(ride.pickupPoint);
    expect(mid.x).toBeCloseTo(lerp(spawn.x, ride.pickupPoint.x, 0.5));
    expect(mid.y).toBeCloseTo(lerp(spawn.y, ride.pickupPoint.y, 0.5));
  });

  it("sits at the pickup point while driver_arrived", () => {
    const ride = makeRide({ phase: "driver_arrived" });
    expect(driverPositionFor(ride, Date.now())).toEqual(ride.pickupPoint);
  });

  it("interpolates from pickup to drop during in_progress", () => {
    const ride = makeRide({ phase: "in_progress", tripStartedAt: 1000, tripEtaAt: 3000 });
    const mid = driverPositionFor(ride, 2000);
    expect(mid.x).toBeCloseTo(lerp(ride.pickupPoint.x, ride.dropPoint.x, 0.5));
    expect(mid.y).toBeCloseTo(lerp(ride.pickupPoint.y, ride.dropPoint.y, 0.5));
  });

  it("lands exactly on the drop point once completed", () => {
    const ride = makeRide({ phase: "completed" });
    expect(driverPositionFor(ride, Date.now())).toEqual(ride.dropPoint);
  });

  it("clamps progress to [0, 1] even if `now` is outside the matched/eta window", () => {
    const ride = makeRide({ phase: "en_route_to_pickup", matchedAt: 1000, pickupEtaAt: 2000 });
    expect(driverPositionFor(ride, 500)).toEqual(spawnPointFor(ride));
    expect(driverPositionFor(ride, 5000)).toEqual(ride.pickupPoint);
  });
});

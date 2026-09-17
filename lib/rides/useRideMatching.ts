"use client";

// The driver-matching simulation: polls candidate drivers one at a time,
// simulates each accepting/timing out, and advances the ride through
// driver_assigned -> en_route_to_pickup. Extracted from RideTrackingView
// verbatim so the "why" notes on its effect-dependency choice stay attached
// to the logic they explain, not buried in a much larger component file.
import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store/useAppStore";
import { candidatesFor, resolveOffer, OFFER_TIMEOUT_MS } from "@/lib/ridesim";
import { ActiveRide } from "@/lib/types";

export function useRideMatching(activeRide: ActiveRide | null) {
  const assignDriver = useAppStore((s) => s.assignDriver);
  const markEnRoute = useAppStore((s) => s.markEnRoute);
  const recordOfferRejected = useAppStore((s) => s.recordOfferRejected);
  const recordSearchFailure = useAppStore((s) => s.recordSearchFailure);

  const [offerLog, setOfferLog] = useState<string[]>([]);

  // Matching simulation — only while actively searching. Depends only on the
  // ride id so it runs once per search (not on every store update), and
  // every store action it calls is phase-guarded/idempotent so a StrictMode
  // double-invoke or a stray resume can't double-assign a driver.
  useEffect(() => {
    if (!activeRide || activeRide.phase !== "searching") return;
    let cancelled = false;
    const rideTypeLabel = activeRide.rideTypeLabel;
    setOfferLog([`Looking for nearby ${rideTypeLabel.toLowerCase()}s near you…`]);

    async function run() {
      while (!cancelled) {
        const ride = useAppStore.getState().activeRide;
        if (!ride || ride.phase !== "searching") return;
        if (Date.now() > (ride.searchDeadlineAt ?? 0)) {
          recordSearchFailure();
          return;
        }
        const candidates = candidatesFor(ride.rideTypeId, ride.triedDriverNames);
        if (candidates.length === 0) {
          recordSearchFailure();
          return;
        }
        const candidate = candidates[0];
        setOfferLog((log) => [
          ...log,
          `Contacting ${candidate.driver.name} (${candidate.driver.rating}★ · ${candidate.simulatedDistanceKm} km)…`,
        ]);
        await new Promise((r) => setTimeout(r, OFFER_TIMEOUT_MS));
        if (cancelled) return;
        const stillSearching = useAppStore.getState().activeRide;
        if (!stillSearching || stillSearching.phase !== "searching") return;

        if (resolveOffer(candidate.driver)) {
          setOfferLog((log) => [...log, `${candidate.driver.name} accepted your ride!`]);
          assignDriver(candidate.driver, candidate.simulatedDistanceKm);
          await new Promise((r) => setTimeout(r, 1200));
          if (cancelled) return;
          markEnRoute();
          return;
        }
        setOfferLog((log) => [...log, `${candidate.driver.name} didn't respond in time.`]);
        recordOfferRejected(candidate.driver.name);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
    // Deliberately keyed only on the ride id, not activeRide.phase: this
    // loop calls assignDriver() itself partway through, which flips the
    // phase and would otherwise re-run this effect (tearing the closure
    // down via the cleanup's `cancelled = true`) before the loop's own
    // post-assignment markEnRoute() call ever fires. The loop already
    // re-reads live phase from the store before every step, so it doesn't
    // need phase in the deps to stay correct.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRide?.id]);

  return offerLog;
}

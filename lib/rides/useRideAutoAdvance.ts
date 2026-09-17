"use client";

// Timestamp-driven auto-advances — resumable across reloads since these
// compare stored target timestamps against wall-clock time, not a
// setTimeout chain that would be lost on unmount. Ticks once a second
// while a ride is active and returns that clock so callers (map position,
// this hook's own advance checks) can derive from a single `now`.
import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store/useAppStore";
import { ActiveRide } from "@/lib/types";

function useTick(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

export function useRideAutoAdvance(activeRide: ActiveRide | null) {
  const markArrived = useAppStore((s) => s.markArrived);
  const completeRide = useAppStore((s) => s.completeRide);

  const now = useTick(Boolean(activeRide));

  useEffect(() => {
    if (!activeRide) return;
    if (activeRide.phase === "en_route_to_pickup" && activeRide.pickupEtaAt && now >= activeRide.pickupEtaAt) {
      markArrived();
    }
    if (activeRide.phase === "in_progress" && activeRide.tripEtaAt && now >= activeRide.tripEtaAt) {
      completeRide();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, activeRide?.phase, activeRide?.pickupEtaAt, activeRide?.tripEtaAt]);

  return now;
}

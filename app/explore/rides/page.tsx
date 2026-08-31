"use client";

import { useAppStore } from "@/lib/store/useAppStore";
import RideRequestPanel from "@/components/rides/RideRequestPanel";
import RideTrackingView from "@/components/rides/RideTrackingView";

export default function RidesPage() {
  const activeRide = useAppStore((s) => s.activeRide);
  return activeRide ? <RideTrackingView /> : <RideRequestPanel />;
}

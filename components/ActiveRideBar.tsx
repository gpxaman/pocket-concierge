"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Navigation } from "lucide-react";
import { useAppStore } from "@/lib/store/useAppStore";
import { RIDE_TYPE_ICON } from "@/lib/data/rideTypes";

const PHASE_LABEL: Record<string, string> = {
  searching: "Finding a driver…",
  driver_assigned: "Driver assigned",
  en_route_to_pickup: "Driver on the way",
  driver_arrived: "Driver has arrived",
  in_progress: "Trip in progress",
  completed: "Rate your trip",
};

/**
 * A persistent, cross-page "you have a ride going" bar — satisfies "open the
 * app, check if there's an active ride" literally rather than only when the
 * user happens to be on the Rides page. Mirrors CallOverlay's pattern of a
 * store-subscribed overlay mounted in the root layout.
 */
export default function ActiveRideBar() {
  const activeRide = useAppStore((s) => s.activeRide);
  const pathname = usePathname();

  if (!activeRide || pathname === "/explore/rides") return null;
  const Icon = RIDE_TYPE_ICON[activeRide.rideTypeId];

  return (
    <Link
      href="/explore/rides"
      className="fixed inset-x-0 bottom-20 z-40 mx-auto flex max-w-md items-center gap-2.5 border-t border-black/5 bg-ink px-5 py-2.5 text-white shadow-lg"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
        {Icon ? <Icon size={16} /> : <Navigation size={16} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold">{PHASE_LABEL[activeRide.phase] ?? "Ride in progress"}</span>
        <span className="block truncate text-[11px] text-white/60">To {activeRide.drop}</span>
      </span>
      <span className="shrink-0 text-[11px] font-medium text-accent">Track →</span>
    </Link>
  );
}

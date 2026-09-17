"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Star, Phone, MapPin, Navigation, ShieldAlert, Share2 } from "lucide-react";
import { useAppStore } from "@/lib/store/useAppStore";
import { RIDE_TYPE_ICON } from "@/lib/data/rideTypes";
import { priceRide } from "@/lib/pricing";
import { findRideType } from "@/lib/data/rideTypes";
import { useRideMatching } from "@/lib/rides/useRideMatching";
import { useRideAutoAdvance } from "@/lib/rides/useRideAutoAdvance";
import { shareOrCopyText } from "@/lib/shareOrCopy";
import RideMap from "@/components/rides/RideMap";
import OtpEntry from "@/components/rides/OtpEntry";
import { ActiveRide } from "@/lib/types";
import BillSummary from "@/components/BillSummary";
import StarRatingInput from "@/components/StarRatingInput";

const PHASE_LABEL: Record<ActiveRide["phase"], string> = {
  searching: "Finding your driver…",
  driver_assigned: "Driver assigned!",
  en_route_to_pickup: "Driver is on the way",
  driver_arrived: "Your driver has arrived",
  in_progress: "On the way to your drop",
  completed: "Trip complete",
  cancelled: "Cancelled",
};

export default function RideTrackingView() {
  const activeRide = useAppStore((s) => s.activeRide);
  const startTrip = useAppStore((s) => s.startTrip);
  const cancelRide = useAppStore((s) => s.cancelRide);
  const rateDriver = useAppStore((s) => s.rateDriver);
  const logAudit = useAppStore((s) => s.logAudit);

  const [shared, setShared] = useState(false);
  const offerLog = useRideMatching(activeRide);
  const now = useRideAutoAdvance(activeRide);

  if (!activeRide) return null;
  const ride = activeRide;
  const Icon = RIDE_TYPE_ICON[ride.rideTypeId];
  const canCancel = ride.phase === "searching" || ride.phase === "driver_assigned" || ride.phase === "en_route_to_pickup" || ride.phase === "driver_arrived";

  function handleSos() {
    if (typeof window === "undefined") return;
    if (window.confirm("Contact emergency services and share your live trip location? (demo)")) {
      logAudit({
        actorType: "USER",
        action: "ride_sos_triggered",
        resourceType: "ride",
        resourceId: ride.transactionId,
        policyDecision: "allowed",
        detail: "Rider triggered SOS during an active ride (demo — no real call placed).",
      });
      window.alert("Demo: your emergency contacts have been notified with your live trip link.");
    }
  }

  async function handleShare() {
    const text = `I'm on a ride from ${ride.pickup} to ${ride.drop} with ${ride.driver?.name ?? "my driver"}. (Pocket Concierge demo trip link)`;
    await shareOrCopyText(text, {
      onCopied: () => {
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      },
    });
  }

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col">
      <div className="relative z-10 flex items-center justify-between px-5 pt-5">
        <Link href="/explore" className="inline-flex items-center gap-1 text-sm text-ink/50 hover:text-ink">
          <ChevronLeft size={16} /> Explore
        </Link>
        {canCancel && (
          <button onClick={cancelRide} className="text-xs font-medium text-red-600 hover:underline">
            Cancel ride
          </button>
        )}
      </div>

      {ride.phase !== "completed" && <RideMap ride={ride} now={now} icon={Icon} />}

      <div className="relative z-10 max-h-[64vh] overflow-y-auto rounded-t-[1.5rem] bg-paper px-5 pb-6 pt-4 shadow-[0_-8px_24px_rgba(0,0,0,0.06)]">
        <p className="text-center text-sm font-semibold text-ink">{PHASE_LABEL[ride.phase]}</p>

        {ride.phase === "searching" && (
          <div className="mt-3 space-y-1.5">
            {offerLog.map((line, i) => (
              <p key={i} className="text-xs text-ink/50">
                {line}
              </p>
            ))}
          </div>
        )}

        {(ride.phase === "driver_assigned" || ride.phase === "en_route_to_pickup" || ride.phase === "driver_arrived" || ride.phase === "in_progress") &&
          ride.driver && (
            <div className="mt-3 rounded-xl2 border border-black/5 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accentSoft text-accentDark">
                  <Icon size={22} strokeWidth={1.7} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{ride.driver.name}</p>
                  <p className="text-xs text-ink/50">{ride.driver.vehicleModel}</p>
                  <p className="text-xs text-ink/45">{ride.driver.vehicleNumber}</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded bg-emerald-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
                  <Star size={10} className="fill-white" /> {ride.driver.rating}
                </span>
              </div>
              <button className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full border border-black/10 py-2 text-xs font-medium text-ink/70">
                <Phone size={13} /> Call driver (demo)
              </button>
            </div>
          )}

        {ride.phase === "driver_arrived" && ride.otp && (
          <div className="mt-4">
            <p className="mb-2 text-center text-xs text-ink/50">Share this OTP with your driver to start the ride</p>
            <OtpEntry otp={ride.otp} onVerified={startTrip} />
          </div>
        )}

        {ride.phase === "in_progress" && (
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleSos}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-red-200 bg-red-50 py-2.5 text-xs font-semibold text-red-600"
            >
              <ShieldAlert size={14} /> SOS
            </button>
            <button
              onClick={handleShare}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-black/10 py-2.5 text-xs font-medium text-ink/70"
            >
              <Share2 size={14} /> {shared ? "Link copied" : "Share trip"}
            </button>
          </div>
        )}

        {(ride.phase === "driver_assigned" ||
          ride.phase === "en_route_to_pickup" ||
          ride.phase === "driver_arrived" ||
          ride.phase === "in_progress") && (
          <div className="mt-4 rounded-xl2 border border-black/5 bg-white p-4 text-sm shadow-sm">
            <div className="flex items-center gap-2">
              <MapPin size={14} className="text-emerald-600" /> <span className="truncate text-ink/70">{ride.pickup}</span>
            </div>
            <div className="ml-[7px] my-1 h-3 border-l border-dashed border-black/15" />
            <div className="flex items-center gap-2">
              <Navigation size={14} className="text-red-500" /> <span className="truncate text-ink/70">{ride.drop}</span>
            </div>
          </div>
        )}

        {ride.phase === "completed" && (
          <div className="mt-4 space-y-4">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accentSoft text-accentDark">
                <Icon size={24} strokeWidth={1.7} />
              </div>
              <p className="mt-2 text-sm font-semibold text-ink">Rate your ride with {ride.driver?.name}</p>
            </div>
            <StarRatingInput value={0} onChange={rateDriver} />
            <BillSummary
              rows={(() => {
                const rt = findRideType(ride.rideTypeId);
                const breakdown = rt ? priceRide(rt, ride.distanceKm) : { baseFare: 0, distanceFare: 0 };
                return [
                  { label: "Base fare", amount: breakdown.baseFare },
                  { label: `Distance (${ride.distanceKm} km)`, amount: breakdown.distanceFare },
                ];
              })()}
              total={ride.fare}
            />
          </div>
        )}
      </div>
    </div>
  );
}

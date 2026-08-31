"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Star, Phone, MapPin, Navigation, ShieldAlert, Share2 } from "lucide-react";
import clsx from "clsx";
import { useAppStore } from "@/lib/store/useAppStore";
import { RIDE_TYPE_ICON } from "@/lib/data/rideTypes";
import { priceRide } from "@/lib/pricing";
import { findRideType } from "@/lib/data/rideTypes";
import { candidatesFor, resolveOffer, OFFER_TIMEOUT_MS } from "@/lib/ridesim";
import { ActiveRide, MapPoint } from "@/lib/types";
import MapPlaceholder from "@/components/MapPlaceholder";
import { LocationPin, VehicleMarker } from "@/components/MapPin";
import BillSummary from "@/components/BillSummary";
import StarRatingInput from "@/components/StarRatingInput";

function useTick(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

function hashToUnit(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Deterministic (not Math.random) driver spawn point near pickup — same on every render for a given ride id. */
function spawnPointFor(ride: ActiveRide): MapPoint {
  const angle = hashToUnit(ride.id) * Math.PI * 2;
  const radius = 15 + hashToUnit(`${ride.id}-r`) * 15;
  return {
    x: Math.min(92, Math.max(8, ride.pickupPoint.x + radius * Math.cos(angle))),
    y: Math.min(88, Math.max(16, ride.pickupPoint.y + radius * Math.sin(angle))),
  };
}

function driverPositionFor(ride: ActiveRide, now: number): MapPoint {
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

function OtpEntry({ otp, onVerified }: { otp: string; onVerified: () => void }) {
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [err, setErr] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  function setDigit(i: number, raw: string) {
    const v = raw.slice(-1);
    if (v && !/^[0-9]$/.test(v)) return;
    const next = [...digits];
    next[i] = v;
    setDigits(next);
    setErr(false);
    if (v && i < 3) refs.current[i + 1]?.focus();
  }

  function verify(code: string) {
    if (code === otp) {
      onVerified();
    } else {
      setErr(true);
      setDigits(["", "", "", ""]);
      refs.current[0]?.focus();
    }
  }

  return (
    <div>
      <div className="flex justify-center gap-2">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            value={d}
            onChange={(e) => setDigit(i, e.target.value)}
            inputMode="numeric"
            maxLength={1}
            className={clsx(
              "h-12 w-11 rounded-xl2 border bg-white text-center text-lg font-bold text-ink outline-none",
              err ? "border-red-400" : "border-black/15 focus:border-accentDark"
            )}
          />
        ))}
      </div>
      {err && <p className="mt-2 text-center text-xs font-medium text-red-600">Incorrect code — try again.</p>}
      <button
        onClick={() => verify(digits.join(""))}
        disabled={digits.some((d) => !d)}
        className="mt-3 flex w-full items-center justify-center rounded-full bg-accent py-3 text-sm font-semibold text-ink transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Verify &amp; start ride
      </button>
      <button
        onClick={() => {
          setDigits(otp.split(""));
          verify(otp);
        }}
        className="mt-2 flex w-full items-center justify-center rounded-full border border-black/10 py-2.5 text-xs font-medium text-ink/60 transition hover:border-ink/30"
      >
        Scan driver&apos;s QR (demo)
      </button>
    </div>
  );
}

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
  const assignDriver = useAppStore((s) => s.assignDriver);
  const markEnRoute = useAppStore((s) => s.markEnRoute);
  const markArrived = useAppStore((s) => s.markArrived);
  const recordOfferRejected = useAppStore((s) => s.recordOfferRejected);
  const recordSearchFailure = useAppStore((s) => s.recordSearchFailure);
  const startTrip = useAppStore((s) => s.startTrip);
  const completeRide = useAppStore((s) => s.completeRide);
  const cancelRide = useAppStore((s) => s.cancelRide);
  const rateDriver = useAppStore((s) => s.rateDriver);
  const logAudit = useAppStore((s) => s.logAudit);

  const [offerLog, setOfferLog] = useState<string[]>([]);
  const [shared, setShared] = useState(false);
  const now = useTick(Boolean(activeRide));

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

  // Timestamp-driven auto-advances — resumable across reloads since these
  // compare stored target timestamps against wall-clock time, not a
  // setTimeout chain that would be lost on unmount.
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

  if (!activeRide) return null;
  const ride = activeRide;
  const Icon = RIDE_TYPE_ICON[ride.rideTypeId];
  const canCancel = ride.phase === "searching" || ride.phase === "driver_assigned" || ride.phase === "en_route_to_pickup" || ride.phase === "driver_arrived";
  const driverPos = driverPositionFor(ride, now);

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
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        // user dismissed the share sheet — fine
      }
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      } catch {
        // clipboard unavailable — fine, this is a demo affordance
      }
    }
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

      {ride.phase !== "completed" && (
        <MapPlaceholder className="relative mt-3 flex-1">
          {ride.phase === "searching" && (
            <>
              <span
                className="voice-ring absolute"
                style={{ left: `${ride.pickupPoint.x}%`, top: `${ride.pickupPoint.y}%`, width: 60, height: 60, marginLeft: -30, marginTop: -30 }}
              />
              <span
                className="voice-ring absolute"
                style={{
                  left: `${ride.pickupPoint.x}%`,
                  top: `${ride.pickupPoint.y}%`,
                  width: 60,
                  height: 60,
                  marginLeft: -30,
                  marginTop: -30,
                  animationDelay: "0.6s",
                }}
              />
            </>
          )}

          <svg className="pointer-events-none absolute inset-0 h-full w-full">
            <line
              x1={`${ride.pickupPoint.x}%`}
              y1={`${ride.pickupPoint.y}%`}
              x2={`${ride.dropPoint.x}%`}
              y2={`${ride.dropPoint.y}%`}
              stroke="#1a1508"
              strokeOpacity={0.25}
              strokeWidth={2}
              strokeDasharray="6 6"
            />
          </svg>

          <LocationPin x={ride.pickupPoint.x} y={ride.pickupPoint.y} kind="pickup" />
          <LocationPin x={ride.dropPoint.x} y={ride.dropPoint.y} kind="drop" />
          {ride.driver && ride.phase !== "searching" && <VehicleMarker x={driverPos.x} y={driverPos.y} icon={Icon} animate />}
        </MapPlaceholder>
      )}

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

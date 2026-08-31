import { LucideIcon, MapPin as MapPinIcon, Navigation } from "lucide-react";
import clsx from "clsx";

/** A fixed location pin (pickup/drop) — teardrop-style marker anchored at its tip. */
export function LocationPin({
  x,
  y,
  kind,
  animate = false,
}: {
  x: number;
  y: number;
  kind: "pickup" | "drop";
  animate?: boolean;
}) {
  const Icon = kind === "pickup" ? MapPinIcon : Navigation;
  const color = kind === "pickup" ? "bg-emerald-600" : "bg-red-500";
  return (
    <div
      className={clsx("absolute -translate-x-1/2 -translate-y-full", animate && "transition-all duration-500 ease-out")}
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      <div className={clsx("flex h-8 w-8 items-center justify-center rounded-full text-white shadow-lg", color)}>
        <Icon size={16} strokeWidth={2.5} />
      </div>
      <div className={clsx("mx-auto h-2 w-2 -translate-y-0.5 rotate-45", color)} />
    </div>
  );
}

/** A small roaming/nearby vehicle marker — no stem, since it represents a moving point, not a fixed address. */
export function VehicleMarker({
  x,
  y,
  icon: Icon,
  delayMs = 0,
  animate = false,
}: {
  x: number;
  y: number;
  icon: LucideIcon;
  delayMs?: number;
  /** When the caller updates x/y over time (live GPS simulation), glide instead of jumping. */
  animate?: boolean;
}) {
  return (
    <div
      className={clsx(
        "absolute -translate-x-1/2 -translate-y-1/2 animate-[fadeInScale_0.4s_ease-out_backwards]",
        animate && "transition-[left,top] duration-1000 ease-linear"
      )}
      style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${delayMs}ms` }}
    >
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-accentDark shadow-md ring-1 ring-black/5">
        <Icon size={13} strokeWidth={2} />
      </div>
    </div>
  );
}

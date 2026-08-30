"use client";

import { motion } from "framer-motion";
import { LucideIcon, MapPin, Circle } from "lucide-react";

// P0 -> P1 -> P2 quadratic Bézier, in percentage viewBox coordinates. Purely
// decorative/abstract (no real geography or maps API) — the point is
// motion, not accuracy.
const P0 = { x: 12, y: 74 };
const P1 = { x: 50, y: 18 };
const P2 = { x: 88, y: 62 };

function bezierPoint(t: number) {
  const x = (1 - t) ** 2 * P0.x + 2 * (1 - t) * t * P1.x + t ** 2 * P2.x;
  const y = (1 - t) ** 2 * P0.y + 2 * (1 - t) * t * P1.y + t ** 2 * P2.y;
  return { x, y };
}

export default function LiveTrackMap({
  progress,
  icon: Icon,
  fromLabel,
  toLabel,
  accentClassName = "stroke-accent",
  markerClassName = "bg-ink text-white",
}: {
  progress: number; // 0-1
  icon: LucideIcon;
  fromLabel: string;
  toLabel: string;
  accentClassName?: string;
  markerClassName?: string;
}) {
  const clamped = Math.max(0, Math.min(1, progress));
  const marker = bezierPoint(clamped);
  const pathD = `M ${P0.x} ${P0.y} Q ${P1.x} ${P1.y} ${P2.x} ${P2.y}`;

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl2 bg-[#0f0e1a]">
      <div
        className="absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)",
          backgroundSize: "10% 12.5%",
        }}
      />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <path d={pathD} fill="none" className="stroke-white/15" strokeWidth={1.6} strokeLinecap="round" />
        <path
          d={pathD}
          fill="none"
          className={accentClassName}
          strokeWidth={1.6}
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={100}
          strokeDashoffset={100 - clamped * 100}
        />
      </svg>

      <div
        className="absolute flex -translate-x-1/2 -translate-y-full flex-col items-center"
        style={{ left: `${P0.x}%`, top: `${P0.y}%` }}
      >
        <Circle size={10} className="fill-white text-white" />
      </div>
      <div
        className="absolute flex -translate-x-1/2 -translate-y-full flex-col items-center"
        style={{ left: `${P2.x}%`, top: `${P2.y}%` }}
      >
        <MapPin size={18} className="fill-accent text-ink" />
      </div>

      <motion.div
        className={`absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full shadow-lg ${markerClassName}`}
        animate={{ left: `${marker.x}%`, top: `${marker.y}%` }}
        transition={{ type: "spring", stiffness: 60, damping: 16 }}
      >
        <Icon size={17} />
      </motion.div>

      <div className="absolute bottom-2 left-2 right-2 flex justify-between text-[10px] font-medium text-white/70">
        <span className="max-w-[45%] truncate">{fromLabel}</span>
        <span className="max-w-[45%] truncate text-right">{toLabel}</span>
      </div>
    </div>
  );
}

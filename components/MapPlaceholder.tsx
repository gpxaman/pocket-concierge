import { ReactNode } from "react";
import clsx from "clsx";

/**
 * Stand-in for a real map (Google Maps is the target provider once API
 * credentials are set up) — a stylized street grid drawn in pure SVG so pin
 * placement/interaction can be built and tested now, with no API key,
 * account, or cost. Swapping in the real Google Maps JS API later only
 * means replacing this component's internals; callers position pins via
 * the same x/y percentage coordinates a real map's projection would use.
 */
export default function MapPlaceholder({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <div className={clsx("relative overflow-hidden bg-[#e9efe0]", className)}>
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="map-grid" width="56" height="56" patternUnits="userSpaceOnUse">
            <rect width="56" height="56" fill="#e9efe0" />
            <path d="M0 0H56M0 0V56" stroke="#d3ddc4" strokeWidth="2" />
          </pattern>
          <pattern id="map-blocks" width="168" height="168" patternUnits="userSpaceOnUse">
            <rect width="168" height="168" fill="url(#map-grid)" />
            <rect x="10" y="14" width="40" height="34" rx="3" fill="#dbe4cd" />
            <rect x="96" y="70" width="52" height="30" rx="3" fill="#dbe4cd" />
            <rect x="24" y="104" width="30" height="46" rx="3" fill="#dbe4cd" />
            <rect x="112" y="16" width="34" height="34" rx="3" fill="#dbe4cd" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#map-blocks)" />
        {/* a couple of thicker "avenues" for visual interest */}
        <rect x="0" y="32%" width="100%" height="10" fill="#c9d5b6" opacity="0.7" />
        <rect x="38%" y="0" width="10" height="100%" fill="#c9d5b6" opacity="0.7" />
      </svg>
      {children}
    </div>
  );
}

import { Suspense } from "react";
import RideBookingView from "@/components/RideBookingView";

export default function RideBookPage() {
  return (
    <Suspense fallback={<div className="px-5 pt-6 text-sm text-ink/40">Loading…</div>}>
      <RideBookingView />
    </Suspense>
  );
}

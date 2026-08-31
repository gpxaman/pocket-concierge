"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import ActivityList from "@/components/ActivityList";

export default function ActivityPage() {
  return (
    <div className="px-5 pt-6 pb-8">
      <Link href="/profile" className="inline-flex items-center gap-1 text-sm text-ink/50 hover:text-ink">
        <ChevronLeft size={16} /> Profile
      </Link>
      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-accentDark">Orders · Bookings · Rides</p>
      <h1 className="mt-1 text-2xl font-semibold text-ink">Activity</h1>
      <div className="mt-4">
        <ActivityList />
      </div>
    </div>
  );
}

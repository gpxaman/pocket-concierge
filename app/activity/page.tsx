"use client";

import ActivityList from "@/components/ActivityList";

export default function ActivityPage() {
  return (
    <div className="px-5 pt-6 pb-8">
      <p className="text-xs font-medium uppercase tracking-wide text-accentDark">Orders · Bookings · Rides</p>
      <h1 className="mt-1 text-2xl font-semibold text-ink">Activity</h1>
      <div className="mt-4">
        <ActivityList />
      </div>
    </div>
  );
}

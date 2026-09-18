"use client";

import { useAppStore } from "@/lib/store/useAppStore";
import { TIERS, tierForPoints, nextTier, progressToNextTier } from "@/lib/loyalty";
import AccordionSection from "@/components/AccordionSection";
import { Award } from "lucide-react";
import clsx from "clsx";

export default function RewardsSection({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const points = useAppStore((s) => s.points);
  const tier = tierForPoints(points);
  const upcoming = nextTier(points);
  const progress = progressToNextTier(points);

  return (
    <AccordionSection
      icon={Award}
      title="Rewards"
      subtitle={`${tier.label} · ${points.toLocaleString("en-IN")} points`}
      open={open}
      onToggle={onToggle}
    >
      <div className="rounded-xl2 p-4 text-white" style={{ background: `linear-gradient(135deg, ${tier.colorFrom}, ${tier.colorTo})` }}>
        <p className="text-xs font-medium text-white/80">Current tier</p>
        <p className="mt-0.5 text-xl font-bold">{tier.label}</p>
        <p className="mt-1 text-sm text-white/90">{points.toLocaleString("en-IN")} points</p>
      </div>

      {upcoming ? (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] text-ink/50">
            <span>{tier.label}</span>
            <span>{upcoming.label}</span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-black/5">
            <div
              className="h-full rounded-full"
              style={{ width: `${progress * 100}%`, background: `linear-gradient(90deg, ${tier.colorFrom}, ${upcoming.colorTo})` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-ink/45">
            {Math.max(0, upcoming.minPoints - points).toLocaleString("en-IN")} points to {upcoming.label}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-[11px] font-medium text-accentDark">You&apos;ve reached the top tier — Diamond.</p>
      )}

      <p className="mt-4 text-xs font-medium text-ink/60">You earn 1 point for every ₹10 spent on orders, bookings and rides.</p>

      <div className="mt-3 space-y-1.5">
        {TIERS.map((t) => (
          <div
            key={t.id}
            className={clsx(
              "flex items-center justify-between rounded-lg px-3 py-2 text-xs",
              t.id === tier.id ? "bg-accentSoft font-semibold text-ink" : "text-ink/50"
            )}
          >
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: `linear-gradient(135deg, ${t.colorFrom}, ${t.colorTo})` }} />
              {t.label}
            </span>
            <span>{t.minPoints.toLocaleString("en-IN")}+ pts</span>
          </div>
        ))}
      </div>
    </AccordionSection>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store/useAppStore";
import { useChatStore } from "@/lib/store/useChatStore";
import { tierForPoints } from "@/lib/loyalty";
import NavRow from "@/components/NavRow";
import RewardsSection from "@/components/profile/RewardsSection";
import PreferencesSection from "@/components/profile/PreferencesSection";
import CreatorSection from "@/components/profile/CreatorSection";
import MemorySection from "@/components/profile/MemorySection";
import SettingsSection from "@/components/profile/SettingsSection";
import AuditSection from "@/components/profile/AuditSection";
import { User, ListChecks, Wallet } from "lucide-react";

export default function ProfilePage() {
  const displayName = useAppStore((s) => s.displayName);
  const points = useAppStore((s) => s.points);

  const identity = useChatStore((s) => s.identity);
  const ensureIdentity = useChatStore((s) => s.ensureIdentity);
  const connect = useChatStore((s) => s.connect);

  const [openSection, setOpenSection] = useState<string | null>(null);

  // Connect on mount, not on submit — claimUsername needs an already-OPEN
  // socket, and new WebSocket(...) takes a beat to connect. The old chat
  // page did this in a mount effect too; moving the username UI here means
  // this page needs the same head start.
  useEffect(() => {
    (async () => {
      await ensureIdentity();
      connect();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(id: string) {
    setOpenSection((cur) => (cur === id ? null : id));
  }

  const tier = tierForPoints(points);

  return (
    <div className="px-5 pt-6 pb-8">
      <p className="text-xs font-medium uppercase tracking-wide text-accentDark">You</p>
      <h1 className="mt-1 text-2xl font-semibold text-ink">Profile</h1>

      {/* Fully tier-colored, matching the Rewards section's "current tier"
          box below — so which tier you're in is obvious at a glance here
          too, not just after opening Rewards. */}
      <div
        className="mt-4 flex items-center gap-3 rounded-xl2 p-4 text-white shadow-sm"
        style={{ background: `linear-gradient(135deg, ${tier.colorFrom}, ${tier.colorTo})` }}
      >
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/20 text-lg font-bold text-white backdrop-blur-sm">
          {(displayName || "?").slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-white">{displayName || "Add your name"}</p>
          <p className="truncate text-xs text-white/70">{identity?.username ? `@${identity.username}` : "No username set"}</p>
        </div>
        <span className="shrink-0 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-bold text-white">{tier.label}</span>
      </div>

      <div className="mt-4 space-y-2.5">
        <NavRow
          href="/profile/account"
          icon={User}
          title="Account"
          subtitle={identity?.username ? `@${identity.username}` : "Name & username"}
        />

        <RewardsSection open={openSection === "rewards"} onToggle={() => toggle("rewards")} />

        <NavRow href="/activity" icon={ListChecks} title="Activity" subtitle="Orders, bookings & rides" />
        <NavRow href="/wallet" icon={Wallet} title="Payments" subtitle="Balance, cards & history" />

        <PreferencesSection open={openSection === "preferences"} onToggle={() => toggle("preferences")} />
        <CreatorSection open={openSection === "creator"} onToggle={() => toggle("creator")} />
        <MemorySection open={openSection === "memory"} onToggle={() => toggle("memory")} />
        <SettingsSection open={openSection === "settings"} onToggle={() => toggle("settings")} />
        <AuditSection open={openSection === "audit"} onToggle={() => toggle("audit")} />
      </div>
    </div>
  );
}

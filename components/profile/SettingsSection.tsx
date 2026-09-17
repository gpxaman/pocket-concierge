"use client";

import { useAppStore } from "@/lib/store/useAppStore";
import AccordionSection from "@/components/AccordionSection";
import { Settings } from "lucide-react";
import clsx from "clsx";

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={clsx("h-6 w-11 shrink-0 rounded-full p-0.5 transition", on ? "bg-accent" : "bg-ink/15")}
    >
      <span className={clsx("block h-5 w-5 rounded-full bg-white transition", on && "translate-x-5")} />
    </button>
  );
}

export default function SettingsSection({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const personalizationEnabled = useAppStore((s) => s.personalizationEnabled);
  const setPersonalizationEnabled = useAppStore((s) => s.setPersonalizationEnabled);
  const clearChat = useAppStore((s) => s.clearChat);

  return (
    <AccordionSection icon={Settings} title="Settings" open={open} onToggle={onToggle}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-ink">Personalization</p>
          <p className="text-[11px] text-ink/40">Lets the concierge use your AI memory and preferences.</p>
        </div>
        <Toggle on={personalizationEnabled} onChange={setPersonalizationEnabled} />
      </div>

      <button
        onClick={clearChat}
        className="mt-4 w-full rounded-lg border border-black/10 px-3 py-2 text-left text-sm font-medium text-ink/70 hover:border-red-300 hover:text-red-500"
      >
        Clear AI chat history
      </button>
    </AccordionSection>
  );
}

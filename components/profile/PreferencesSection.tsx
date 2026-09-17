"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store/useAppStore";
import AccordionSection from "@/components/AccordionSection";
import { Trash2, Plus, SlidersHorizontal } from "lucide-react";

export default function PreferencesSection({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const preferences = useAppStore((s) => s.preferences);
  const setPreference = useAppStore((s) => s.setPreference);
  const deletePreference = useAppStore((s) => s.deletePreference);

  const [prefKey, setPrefKey] = useState("");
  const [prefValue, setPrefValue] = useState("");

  return (
    <AccordionSection
      icon={SlidersHorizontal}
      title="Preferences"
      subtitle={`${preferences.length} saved`}
      open={open}
      onToggle={onToggle}
    >
      <p className="text-[11px] text-ink/40">Explicit, durable choices — brands, sizes, locations, hotel picks.</p>

      <div className="mt-3 space-y-2">
        {preferences.map((p) => (
          <div key={p.key} className="flex items-center justify-between rounded-xl border border-black/5 bg-white px-3 py-2">
            <div>
              <p className="text-xs font-medium text-ink/50">{p.key}</p>
              <p className="text-sm text-ink">{p.value}</p>
            </div>
            <button onClick={() => deletePreference(p.key)} className="text-ink/30 hover:text-red-500">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-2 flex gap-2">
        <input
          value={prefKey}
          onChange={(e) => setPrefKey(e.target.value)}
          placeholder="key (e.g. hotel_class)"
          className="w-2/5 rounded-lg border border-black/10 bg-white px-2 py-1.5 text-xs outline-none focus:border-accentDark"
        />
        <input
          value={prefValue}
          onChange={(e) => setPrefValue(e.target.value)}
          placeholder="value (e.g. 4-star, refundable)"
          className="flex-1 rounded-lg border border-black/10 bg-white px-2 py-1.5 text-xs outline-none focus:border-accentDark"
        />
        <button
          onClick={() => {
            if (!prefKey.trim() || !prefValue.trim()) return;
            setPreference(prefKey.trim(), prefValue.trim());
            setPrefKey("");
            setPrefValue("");
          }}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-ink"
        >
          <Plus size={14} />
        </button>
      </div>
    </AccordionSection>
  );
}

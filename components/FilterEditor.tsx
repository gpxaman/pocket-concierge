"use client";

import { useState } from "react";
import { FilterSettings } from "@/lib/types";
import { BUILTIN_PRESETS, NEUTRAL_FILTER, filterToCss } from "@/lib/filters";

const SLIDERS: { key: keyof FilterSettings; label: string; min: number; max: number }[] = [
  { key: "brightness", label: "Brightness", min: 40, max: 160 },
  { key: "contrast", label: "Contrast", min: 40, max: 160 },
  { key: "saturation", label: "Saturation", min: 0, max: 200 },
  { key: "hueRotate", label: "Tint", min: -180, max: 180 },
  { key: "sepia", label: "Sepia", min: 0, max: 100 },
  { key: "grayscale", label: "Grayscale", min: 0, max: 100 },
];

export default function FilterEditor({
  onSave,
  onCancel,
}: {
  onSave: (name: string, settings: FilterSettings) => void;
  onCancel: () => void;
}) {
  const [settings, setSettings] = useState<FilterSettings>(NEUTRAL_FILTER);
  const [name, setName] = useState("");

  return (
    <div className="rounded-xl2 border border-black/10 bg-white p-4 shadow-sm">
      <div
        className="flex h-32 w-full items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-400 via-amber-300 to-cyan-400 text-4xl"
        style={{ filter: filterToCss(settings) }}
      >
        🎨🌆✨
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {BUILTIN_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSettings(p)}
            className="rounded-full border border-black/10 px-2.5 py-1 text-[11px] font-medium text-ink/70 hover:border-accentDark hover:text-accentDark"
          >
            {p.name}
          </button>
        ))}
      </div>

      <div className="mt-3 space-y-2.5">
        {SLIDERS.map((s) => (
          <div key={s.key}>
            <div className="flex items-center justify-between text-[11px] text-ink/50">
              <span>{s.label}</span>
              <span>{settings[s.key]}</span>
            </div>
            <input
              type="range"
              min={s.min}
              max={s.max}
              value={settings[s.key]}
              onChange={(e) => setSettings((prev) => ({ ...prev, [s.key]: Number(e.target.value) }))}
              className="w-full accent-accentDark"
            />
          </div>
        ))}
      </div>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Filter name (e.g. Golden Hour)"
        className="mt-3 w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-accentDark"
      />

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => name.trim() && onSave(name.trim(), settings)}
          disabled={!name.trim()}
          className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-ink hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save filter
        </button>
        <button type="button" onClick={onCancel} className="rounded-full px-3 py-1.5 text-xs text-ink/50 hover:text-ink">
          Cancel
        </button>
      </div>
    </div>
  );
}

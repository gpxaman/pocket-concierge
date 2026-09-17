"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store/useAppStore";
import AccordionSection from "@/components/AccordionSection";
import { Trash2, Plus, Brain } from "lucide-react";

export default function MemorySection({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const memory = useAppStore((s) => s.memory);
  const addMemory = useAppStore((s) => s.addMemory);
  const deleteMemory = useAppStore((s) => s.deleteMemory);
  const clearMemory = useAppStore((s) => s.clearMemory);
  const personalizationEnabled = useAppStore((s) => s.personalizationEnabled);

  const [memoryFact, setMemoryFact] = useState("");

  return (
    <AccordionSection icon={Brain} title="AI memory" subtitle={`${memory.length} learned facts`} open={open} onToggle={onToggle}>
      <p className="text-[11px] text-ink/40">Learned context. View, edit, delete any time (MEM-001).</p>

      {!personalizationEnabled && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
          Personalization is off in Settings — the concierge will not read or write memory.
        </p>
      )}

      <div className="mt-3 space-y-2">
        {memory.map((m) => (
          <div key={m.id} className="flex items-start justify-between gap-2 rounded-xl border border-black/5 bg-white px-3 py-2">
            <div>
              <p className="text-sm text-ink">{m.fact}</p>
              <p className="text-[11px] text-ink/40">
                {m.provenance} · confidence {Math.round(m.confidence * 100)}%
              </p>
            </div>
            <button onClick={() => deleteMemory(m.id)} className="shrink-0 text-ink/30 hover:text-red-500">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        {memory.length === 0 && <p className="text-xs text-ink/35">No memory saved yet.</p>}
      </div>

      <div className="mt-2 flex gap-2">
        <input
          value={memoryFact}
          onChange={(e) => setMemoryFact(e.target.value)}
          placeholder="e.g. Prefers window seats"
          className="flex-1 rounded-lg border border-black/10 bg-white px-2 py-1.5 text-xs outline-none focus:border-accentDark"
        />
        <button
          onClick={() => {
            if (!memoryFact.trim()) return;
            addMemory(memoryFact.trim(), "explicit");
            setMemoryFact("");
          }}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-ink"
        >
          <Plus size={14} />
        </button>
      </div>

      {memory.length > 0 && (
        <button onClick={clearMemory} className="mt-2 text-[11px] font-medium text-red-500 hover:underline">
          Clear all memory
        </button>
      )}
    </AccordionSection>
  );
}

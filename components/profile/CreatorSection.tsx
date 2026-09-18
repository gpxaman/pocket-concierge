"use client";

import { useState } from "react";
import { useSnapStore } from "@/lib/store/useSnapStore";
import { filterToCss } from "@/lib/filters";
import FilterEditor from "@/components/FilterEditor";
import AccordionSection from "@/components/AccordionSection";
import { Trash2, Plus, BadgeCheck, Palette, LogOut } from "lucide-react";

export default function CreatorSection({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const creatorProfile = useSnapStore((s) => s.creatorProfile);
  const registerCreator = useSnapStore((s) => s.registerCreator);
  const unregisterCreator = useSnapStore((s) => s.unregisterCreator);
  const filters = useSnapStore((s) => s.filters);
  const createFilter = useSnapStore((s) => s.createFilter);
  const deleteFilter = useSnapStore((s) => s.deleteFilter);

  const [handle, setHandle] = useState("");
  const [category, setCategory] = useState("");
  const [bio, setBio] = useState("");
  const [creatorError, setCreatorError] = useState("");
  const [showFilterEditor, setShowFilterEditor] = useState(false);

  return (
    <AccordionSection
      icon={BadgeCheck}
      title="Creator"
      subtitle={creatorProfile ? creatorProfile.handle : "Not registered"}
      open={open}
      onToggle={onToggle}
    >
      <p className="text-[11px] text-ink/40">Register as a creator to design and publish your own Snap filters.</p>

      {!creatorProfile ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!handle.trim() || !category.trim()) {
              setCreatorError("Handle and category are required.");
              return;
            }
            registerCreator({ handle, category, bio });
            setCreatorError("");
          }}
          className="mt-2 space-y-2 rounded-xl2 border border-black/10 bg-white p-3 shadow-sm"
        >
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="Creator handle (e.g. aman.designs)"
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-accentDark"
          />
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Category (e.g. Photography, Fashion, Travel)"
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-accentDark"
          />
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Short bio (optional)"
            rows={2}
            className="w-full resize-none rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-accentDark"
          />
          {creatorError && <p className="text-xs text-red-500">{creatorError}</p>}
          <button type="submit" className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-ink hover:brightness-95">
            Register as creator
          </button>
        </form>
      ) : (
        <div className="mt-2 space-y-3">
          <div className="rounded-xl2 border border-black/10 bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-ink">{creatorProfile.handle}</p>
                <p className="text-xs text-accentDark">{creatorProfile.category}</p>
                {creatorProfile.bio && <p className="mt-1 text-xs text-ink/50">{creatorProfile.bio}</p>}
              </div>
              <button onClick={unregisterCreator} className="text-ink/30 hover:text-red-500" title="Unregister">
                <LogOut size={15} />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink/70">
              <Palette size={13} /> Your filters
            </p>
            {!showFilterEditor && (
              <button
                onClick={() => setShowFilterEditor(true)}
                className="inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-white hover:bg-ink/85"
              >
                <Plus size={12} /> Create a filter
              </button>
            )}
          </div>

          {showFilterEditor && (
            <FilterEditor
              onSave={(name, settings) => {
                createFilter(name, settings);
                setShowFilterEditor(false);
              }}
              onCancel={() => setShowFilterEditor(false)}
            />
          )}

          {filters.length === 0 && !showFilterEditor && (
            <p className="text-xs text-ink/35">No filters yet — create one and it&apos;ll show up in Snap.</p>
          )}

          <div className="grid grid-cols-3 gap-2">
            {filters.map((f) => (
              <div key={f.id} className="relative rounded-xl border border-black/5 bg-white p-2 shadow-sm">
                <div
                  className="flex h-12 w-full items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-400 via-amber-300 to-cyan-400 text-lg"
                  style={{ filter: filterToCss(f) }}
                >
                  🎨
                </div>
                <p className="mt-1 truncate text-[11px] font-medium text-ink">{f.name}</p>
                <button
                  onClick={() => deleteFilter(f.id)}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-ink/40 hover:text-red-500"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </AccordionSection>
  );
}

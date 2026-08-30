"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store/useAppStore";
import { useSnapStore } from "@/lib/store/useSnapStore";
import FilterEditor from "@/components/FilterEditor";
import { filterToCss } from "@/lib/filters";
import { Trash2, ShieldAlert, Plus, BadgeCheck, Palette, LogOut } from "lucide-react";
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

export default function ProfilePage() {
  const displayName = useAppStore((s) => s.displayName);
  const setDisplayName = useAppStore((s) => s.setDisplayName);

  const preferences = useAppStore((s) => s.preferences);
  const setPreference = useAppStore((s) => s.setPreference);
  const deletePreference = useAppStore((s) => s.deletePreference);

  const memory = useAppStore((s) => s.memory);
  const addMemory = useAppStore((s) => s.addMemory);
  const deleteMemory = useAppStore((s) => s.deleteMemory);
  const clearMemory = useAppStore((s) => s.clearMemory);

  const personalizationEnabled = useAppStore((s) => s.personalizationEnabled);
  const setPersonalizationEnabled = useAppStore((s) => s.setPersonalizationEnabled);

  const audit = useAppStore((s) => s.audit);

  const creatorProfile = useSnapStore((s) => s.creatorProfile);
  const registerCreator = useSnapStore((s) => s.registerCreator);
  const unregisterCreator = useSnapStore((s) => s.unregisterCreator);
  const filters = useSnapStore((s) => s.filters);
  const createFilter = useSnapStore((s) => s.createFilter);
  const deleteFilter = useSnapStore((s) => s.deleteFilter);

  const [prefKey, setPrefKey] = useState("");
  const [prefValue, setPrefValue] = useState("");
  const [memoryFact, setMemoryFact] = useState("");
  const [showAudit, setShowAudit] = useState(false);

  const [handle, setHandle] = useState("");
  const [category, setCategory] = useState("");
  const [bio, setBio] = useState("");
  const [creatorError, setCreatorError] = useState("");
  const [showFilterEditor, setShowFilterEditor] = useState(false);

  return (
    <div className="px-5 pt-6 pb-8">
      <p className="text-xs font-medium uppercase tracking-wide text-accentDark">Identity</p>
      <h1 className="mt-1 text-2xl font-semibold text-ink">Profile</h1>

      <section className="mt-5">
        <label className="text-xs font-semibold uppercase tracking-wide text-ink/40">What should I call you?</label>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Aman"
          className="mt-1.5 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-accentDark"
        />
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink/70">Preferences</h2>
        </div>
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
      </section>

      <section className="mt-6">
        <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink/70">
          <BadgeCheck size={15} /> Creator
        </h2>
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
              <p className="text-xs text-ink/35">No filters yet — create one and it'll show up in Snap.</p>
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
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-ink/70">AI memory</h2>
            <p className="text-[11px] text-ink/40">Learned context. View, edit, delete or disable any time (MEM-001).</p>
          </div>
          <Toggle on={personalizationEnabled} onChange={setPersonalizationEnabled} />
        </div>

        {!personalizationEnabled && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
            Personalization is off — the concierge will not read or write memory.
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
      </section>

      <section className="mt-6">
        <button
          onClick={() => setShowAudit((v) => !v)}
          className="flex w-full items-center justify-between rounded-xl border border-black/5 bg-white px-3 py-2.5 text-sm font-medium text-ink/70"
        >
          <span className="inline-flex items-center gap-2">
            <ShieldAlert size={15} /> AI action audit trail
          </span>
          <span className="text-xs text-ink/40">{audit.length} records</span>
        </button>

        {showAudit && (
          <div className="mt-2 max-h-64 space-y-2 overflow-y-auto rounded-xl bg-white p-3 shadow-inner">
            {audit.length === 0 && <p className="text-xs text-ink/35">No actions recorded yet.</p>}
            {audit.map((a) => (
              <div key={a.id} className="border-b border-black/5 pb-2 text-[11px] last:border-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-ink">{a.action}</span>
                  <span
                    className={clsx(
                      "rounded-full px-1.5 py-0.5",
                      a.policyDecision === "allowed" && "bg-emerald-50 text-emerald-600",
                      a.policyDecision === "requires_confirmation" && "bg-amber-50 text-amber-700",
                      a.policyDecision === "blocked" && "bg-red-50 text-red-500"
                    )}
                  >
                    {a.policyDecision}
                  </span>
                </div>
                <p className="text-ink/50">
                  {a.actorType} · {a.resourceType}
                  {a.resourceId ? ` · ${a.resourceId}` : ""}
                </p>
                {a.detail && <p className="mt-0.5 text-ink/40">{a.detail}</p>}
                <p className="text-ink/30">{new Date(a.timestamp).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

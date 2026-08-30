"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store/useAppStore";
import { useChatStore } from "@/lib/store/useChatStore";
import { TIERS, tierForPoints, nextTier, progressToNextTier } from "@/lib/loyalty";
import AccordionSection from "@/components/AccordionSection";
import { Trash2, ShieldAlert, Plus, User, Award, SlidersHorizontal, Brain, Settings, Pencil, Check } from "lucide-react";
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

  const points = useAppStore((s) => s.points);

  const preferences = useAppStore((s) => s.preferences);
  const setPreference = useAppStore((s) => s.setPreference);
  const deletePreference = useAppStore((s) => s.deletePreference);

  const memory = useAppStore((s) => s.memory);
  const addMemory = useAppStore((s) => s.addMemory);
  const deleteMemory = useAppStore((s) => s.deleteMemory);
  const clearMemory = useAppStore((s) => s.clearMemory);

  const personalizationEnabled = useAppStore((s) => s.personalizationEnabled);
  const setPersonalizationEnabled = useAppStore((s) => s.setPersonalizationEnabled);
  const clearChat = useAppStore((s) => s.clearChat);

  const audit = useAppStore((s) => s.audit);

  const identity = useChatStore((s) => s.identity);
  const usernameStatus = useChatStore((s) => s.usernameStatus);
  const claimUsername = useChatStore((s) => s.claimUsername);
  const ensureIdentity = useChatStore((s) => s.ensureIdentity);
  const connect = useChatStore((s) => s.connect);

  const [openSection, setOpenSection] = useState<string | null>("account");
  const [usernameInput, setUsernameInput] = useState("");
  const [editingUsername, setEditingUsername] = useState(false);
  const [prefKey, setPrefKey] = useState("");
  const [prefValue, setPrefValue] = useState("");
  const [memoryFact, setMemoryFact] = useState("");

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

  async function handleSetUsername(e: React.FormEvent) {
    e.preventDefault();
    const result = await claimUsername(usernameInput);
    if (result.ok) {
      setUsernameInput("");
      setEditingUsername(false);
    }
  }

  const tier = tierForPoints(points);
  const upcoming = nextTier(points);
  const progress = progressToNextTier(points);

  return (
    <div className="px-5 pt-6 pb-8">
      <p className="text-xs font-medium uppercase tracking-wide text-accentDark">You</p>
      <h1 className="mt-1 text-2xl font-semibold text-ink">Profile</h1>

      <div className="mt-4 flex items-center gap-3 rounded-xl2 border border-black/5 bg-white p-4 shadow-sm">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
          style={{ background: `linear-gradient(135deg, ${tier.colorFrom}, ${tier.colorTo})` }}
        >
          {(displayName || "?").slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-ink">{displayName || "Add your name"}</p>
          <p className="truncate text-xs text-ink/45">{identity?.username ? `@${identity.username}` : "No username set"}</p>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold text-white"
          style={{ background: `linear-gradient(135deg, ${tier.colorFrom}, ${tier.colorTo})` }}
        >
          {tier.label}
        </span>
      </div>

      <div className="mt-4 space-y-2.5">
        <AccordionSection
          icon={User}
          title="Account"
          subtitle="Name & username"
          open={openSection === "account"}
          onToggle={() => toggle("account")}
        >
          <label className="text-xs font-semibold uppercase tracking-wide text-ink/40">What should I call you?</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Aman"
            className="mt-1.5 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-accentDark"
          />

          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/40">Chat username</p>
            <p className="mt-0.5 text-[11px] text-ink/40">Lets others find and message you — end-to-end encrypted.</p>

            {!editingUsername && identity?.username ? (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 rounded-lg bg-accentSoft px-3 py-2 text-sm font-medium text-ink">@{identity.username}</div>
                <button
                  onClick={() => {
                    setUsernameInput(identity.username ?? "");
                    setEditingUsername(true);
                  }}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink/40 hover:text-ink"
                  title="Change username"
                >
                  <Pencil size={15} />
                </button>
              </div>
            ) : (
              <form onSubmit={handleSetUsername} className="mt-2">
                <div className="flex items-center gap-2">
                  <input
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder="e.g. aman_k"
                    className="flex-1 rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-accentDark"
                  />
                  <button
                    type="submit"
                    disabled={usernameStatus === "checking" || !usernameInput.trim()}
                    className="flex h-9 shrink-0 items-center justify-center rounded-lg bg-accent px-3 text-xs font-semibold text-ink disabled:opacity-40"
                  >
                    {usernameStatus === "checking" ? "Checking…" : "Save"}
                  </button>
                </div>
                {usernameStatus === "taken" && <p className="mt-1 text-xs text-red-500">That username's taken — try another.</p>}
                {usernameStatus === "invalid" && (
                  <p className="mt-1 text-xs text-red-500">3-20 letters, numbers or underscores only.</p>
                )}
              </form>
            )}
            {identity?.username && !editingUsername && (
              <p className="mt-2 inline-flex items-center gap-1 text-[10px] text-ink/30">
                <Check size={10} /> Signed in as @{identity.username}
              </p>
            )}
          </div>
        </AccordionSection>

        <AccordionSection
          icon={Award}
          title="Rewards"
          subtitle={`${tier.label} · ${points.toLocaleString("en-IN")} points`}
          open={openSection === "rewards"}
          onToggle={() => toggle("rewards")}
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
            <p className="mt-3 text-[11px] font-medium text-accentDark">You've reached the top tier — Diamond.</p>
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

        <AccordionSection
          icon={SlidersHorizontal}
          title="Preferences"
          subtitle={`${preferences.length} saved`}
          open={openSection === "preferences"}
          onToggle={() => toggle("preferences")}
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

        <AccordionSection
          icon={Brain}
          title="AI memory"
          subtitle={`${memory.length} learned facts`}
          open={openSection === "memory"}
          onToggle={() => toggle("memory")}
        >
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

        <AccordionSection icon={Settings} title="Settings" open={openSection === "settings"} onToggle={() => toggle("settings")}>
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

        <AccordionSection
          icon={ShieldAlert}
          title="Audit trail"
          subtitle={`${audit.length} records`}
          open={openSection === "audit"}
          onToggle={() => toggle("audit")}
        >
          <div className="max-h-64 space-y-2 overflow-y-auto">
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
        </AccordionSection>
      </div>
    </div>
  );
}

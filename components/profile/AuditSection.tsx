"use client";

import { useAppStore } from "@/lib/store/useAppStore";
import AccordionSection from "@/components/AccordionSection";
import { ShieldAlert } from "lucide-react";
import clsx from "clsx";

export default function AuditSection({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const audit = useAppStore((s) => s.audit);

  return (
    <AccordionSection icon={ShieldAlert} title="Audit trail" subtitle={`${audit.length} records`} open={open} onToggle={onToggle}>
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
  );
}

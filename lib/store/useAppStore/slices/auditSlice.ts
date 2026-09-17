// The append-only trail every other slice writes to (TRD §23.3) — kept
// capped at 200 records so it can't grow the persisted store unboundedly
// over a long session.
import { StateCreator } from "zustand";
import { AppState, AuditSlice } from "../types";
import { uid } from "../helpers";

export const createAuditSlice: StateCreator<AppState, [], [], AuditSlice> = (set) => ({
  audit: [],

  logAudit: (a) =>
    set((s) => ({
      audit: [
        {
          id: uid("audit"),
          timestamp: Date.now(),
          correlationId: a.correlationId ?? uid("corr"),
          ...a,
        },
        ...s.audit,
      ].slice(0, 200),
    })),
});

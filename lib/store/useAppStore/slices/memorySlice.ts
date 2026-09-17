import { StateCreator } from "zustand";
import { AppState, MemorySlice } from "../types";
import { uid } from "../helpers";

export const createMemorySlice: StateCreator<AppState, [], [], MemorySlice> = (set) => ({
  memory: [],
  personalizationEnabled: true,

  addMemory: (fact, provenance, confidence = provenance === "explicit" ? 1 : 0.6) =>
    set((s) => ({
      memory: [{ id: uid("mem"), fact, provenance, confidence, createdAt: Date.now() }, ...s.memory],
    })),
  deleteMemory: (id) => set((s) => ({ memory: s.memory.filter((m) => m.id !== id) })),
  clearMemory: () => set({ memory: [] }),
  setPersonalizationEnabled: (v) => set({ personalizationEnabled: v }),
});

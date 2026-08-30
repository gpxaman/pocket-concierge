"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CreatorFilter, CreatorProfile, FilterSettings, Snap } from "@/lib/types";

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

interface SnapState {
  creatorProfile: CreatorProfile | null;
  filters: CreatorFilter[];
  snaps: Snap[];

  registerCreator: (input: { handle: string; category: string; bio: string }) => void;
  unregisterCreator: () => void;

  createFilter: (name: string, settings: FilterSettings) => CreatorFilter;
  deleteFilter: (id: string) => void;

  addSnap: (dataUrl: string, filterName: string) => void;
  deleteSnap: (id: string) => void;
}

export const useSnapStore = create<SnapState>()(
  persist(
    (set) => ({
      creatorProfile: null,
      filters: [],
      snaps: [],

      registerCreator: ({ handle, category, bio }) =>
        set({
          creatorProfile: { handle: handle.trim(), category: category.trim(), bio: bio.trim(), registeredAt: Date.now() },
        }),
      unregisterCreator: () => set({ creatorProfile: null }),

      createFilter: (name, settings) => {
        const filter: CreatorFilter = { id: uid("filter"), name: name.trim() || "Untitled filter", ...settings, createdAt: Date.now() };
        set((s) => ({ filters: [filter, ...s.filters] }));
        return filter;
      },
      deleteFilter: (id) => set((s) => ({ filters: s.filters.filter((f) => f.id !== id) })),

      addSnap: (dataUrl, filterName) =>
        set((s) => ({ snaps: [{ id: uid("snap"), dataUrl, filterName, createdAt: Date.now() }, ...s.snaps].slice(0, 60) })),
      deleteSnap: (id) => set((s) => ({ snaps: s.snaps.filter((sn) => sn.id !== id) })),
    }),
    { name: "pocket-concierge-snap", version: 1 }
  )
);

// Barrel: every domain type file re-exported from one place, so every
// existing `import { X } from "@/lib/types"` across the app keeps working
// unchanged. Add new domain types as a new file here + a line below —
// don't grow one of the domain files across domains.

export * from "./catalog";
export * from "./transactions";
export * from "./payments";
export * from "./misc";
export * from "./chat";
export * from "./snap";
export * from "./rides";
export * from "./food";

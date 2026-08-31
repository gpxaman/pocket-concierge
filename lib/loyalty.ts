export interface Tier {
  id: string;
  label: string;
  minPoints: number;
  colorFrom: string;
  colorTo: string;
}

// Lifetime points, 1 point per ₹10 spent on any completed order, booking or
// ride (charged at the same moment the wallet is debited — see
// useAppStore's placeOrderFromCart/bookHotel/completeRide).
export const TIERS: Tier[] = [
  { id: "bronze", label: "Bronze", minPoints: 0, colorFrom: "#b08d57", colorTo: "#6b4a26" },
  { id: "silver", label: "Silver", minPoints: 500, colorFrom: "#c9d1d9", colorTo: "#8b95a1" },
  { id: "gold", label: "Gold", minPoints: 1500, colorFrom: "#ffe27a", colorTo: "#c98f00" },
  { id: "platinum", label: "Platinum", minPoints: 4000, colorFrom: "#a5f3fc", colorTo: "#0e7490" },
  { id: "diamond", label: "Diamond", minPoints: 10000, colorFrom: "#e0c3fc", colorTo: "#7c3aed" },
];

export const POINTS_PER_RUPEE = 1 / 10;

export function pointsForAmount(amount: number): number {
  return Math.floor(amount * POINTS_PER_RUPEE);
}

export function tierForPoints(points: number): Tier {
  let current = TIERS[0];
  for (const tier of TIERS) {
    if (points >= tier.minPoints) current = tier;
  }
  return current;
}

/** Next tier up, or null if already at the top tier. */
export function nextTier(points: number): Tier | null {
  const current = tierForPoints(points);
  const idx = TIERS.findIndex((t) => t.id === current.id);
  return idx >= 0 && idx < TIERS.length - 1 ? TIERS[idx + 1] : null;
}

/** 0-1 progress from the current tier's threshold to the next tier's. 1 if already at the top tier. */
export function progressToNextTier(points: number): number {
  const current = tierForPoints(points);
  const next = nextTier(points);
  if (!next) return 1;
  const span = next.minPoints - current.minPoints;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (points - current.minPoints) / span));
}

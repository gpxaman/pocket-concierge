// Deliberately NOT d.toISOString().slice(0, 10) — that converts to UTC
// first, which silently rolls back to the previous calendar day for anyone
// in a timezone ahead of UTC (IST is UTC+5:30, so this bit for hours before
// 5:30am IST) — exactly the audience this app targets. getFullYear/
// getMonth/getDate are local-time based, so this matches the date the
// user's own device says "today" actually is.
export function isoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

// A function, not a module-level constant — a constant would be computed
// once at module load and go stale if the process/session outlives midnight.
export function todayIso(): string {
  return isoDate(new Date());
}

export function formatDateLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

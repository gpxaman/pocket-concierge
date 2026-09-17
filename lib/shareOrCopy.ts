// Identical "native share sheet, falling back to clipboard" logic was
// copy-pasted into HomeAgent's transcript share and RideTrackingView's trip
// share — pulled out once so there's a single place that decides how a
// demo "share" affordance behaves across the app.
export async function shareOrCopyText(text: string, opts?: { title?: string; onCopied?: () => void }): Promise<void> {
  if (!text) return;
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ text, title: opts?.title });
    } catch {
      // user dismissed the share sheet — fine
    }
  } else if (typeof navigator !== "undefined" && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      opts?.onCopied?.();
    } catch {
      // clipboard unavailable — fine, this is a demo/nice-to-have affordance
    }
  }
}

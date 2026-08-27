import clsx from "clsx";
import { TransactionStatus } from "@/lib/types";

const LABELS: Record<TransactionStatus, string> = {
  draft: "Draft",
  pending_authorization: "Pending authorization",
  pending_vendor: "Pending vendor",
  confirmed: "Confirmed",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

// Deliberately not tied to the yellow brand accent — status badges need to
// stay visually distinct from each other regardless of theme, so these use
// conventional semantic colors instead of `accent`/`accentSoft`.
const STYLES: Record<TransactionStatus, string> = {
  draft: "bg-ink/8 text-ink/60",
  pending_authorization: "bg-orange-100 text-orange-700",
  pending_vendor: "bg-orange-100 text-orange-700",
  confirmed: "bg-blue-100 text-blue-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-600",
};

export default function StatusBadge({ status }: { status: TransactionStatus }) {
  return (
    <span className={clsx("rounded-full px-2 py-0.5 text-[11px] font-medium", STYLES[status])}>
      {LABELS[status]}
    </span>
  );
}

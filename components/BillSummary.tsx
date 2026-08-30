interface BillRow {
  label: string;
  amount: number;
  /** Rendered green ("−₹x") instead of the default ink color. */
  isDiscount?: boolean;
  /** Rendered as "FREE" instead of ₹0. */
  freeIfZero?: boolean;
}

export default function BillSummary({ rows, total }: { rows: BillRow[]; total: number }) {
  return (
    <div className="rounded-xl2 border border-black/5 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink/40">Bill details</p>
      <div className="mt-3 space-y-2 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between text-ink/70">
            <span>{row.label}</span>
            <span className={row.isDiscount ? "font-medium text-emerald-600" : "text-ink"}>
              {row.isDiscount ? "−" : ""}
              {row.freeIfZero && row.amount === 0 ? "FREE" : `₹${Math.abs(row.amount).toLocaleString("en-IN")}`}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-dashed border-black/10 pt-3 text-sm font-bold text-ink">
        <span>To Pay</span>
        <span>₹{total.toLocaleString("en-IN")}</span>
      </div>
    </div>
  );
}

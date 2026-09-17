import { beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "@/lib/store/useAppStore";
import { findById } from "@/lib/data/catalog";

// Exercises multiple slices together through the real store (not mocked
// set/get) — the createDraft -> authorizeTransaction -> advanceTransaction
// lifecycle spans TransactionsSlice, WalletSlice, and AuditSlice, and this
// is the seam most likely to break silently if a future slice split
// accidentally stops sharing the same `set`/`get`.
describe("useAppStore transaction lifecycle", () => {
  beforeEach(() => {
    useAppStore.setState({ transactions: [], ledger: [], audit: [], walletBalance: 0 });
  });

  it("moves a wallet-funded order from draft through to completed, debiting the wallet and logging both", () => {
    const item = findById("food-001")!; // North Indian Thali, ₹249
    useAppStore.getState().addBalance(1000);

    const draft = useAppStore.getState().createDraft(item, "ORDER");
    expect(draft.status).toBe("draft");
    expect(useAppStore.getState().walletBalance).toBe(1000); // draft alone never touches the wallet

    const result = useAppStore.getState().authorizeTransaction(draft.id, "wallet");
    expect(result.ok).toBe(true);
    expect(useAppStore.getState().walletBalance).toBe(1000 - item.price);

    const ledgerEntry = useAppStore.getState().ledger[0];
    expect(ledgerEntry.transactionId).toBe(draft.id);
    expect(ledgerEntry.amount).toBe(item.price);
    expect(ledgerEntry.direction).toBe("debit");

    let tx = useAppStore.getState().transactions.find((t) => t.id === draft.id)!;
    expect(tx.status).toBe("pending_vendor");

    useAppStore.getState().advanceTransaction(draft.id); // -> in_progress
    tx = useAppStore.getState().transactions.find((t) => t.id === draft.id)!;
    expect(tx.status).toBe("in_progress");

    useAppStore.getState().advanceTransaction(draft.id); // -> completed
    tx = useAppStore.getState().transactions.find((t) => t.id === draft.id)!;
    expect(tx.status).toBe("completed");
    expect(tx.history.map((h) => h.status)).toEqual(["draft", "pending_vendor", "in_progress", "completed"]);

    const auditActions = useAppStore.getState().audit.map((a) => a.action);
    expect(auditActions).toContain("draft_created");
    expect(auditActions).toContain("purchase_authorized");
  });

  it("blocks authorization and logs a blocked audit entry when the wallet balance is insufficient", () => {
    const item = findById("food-001")!; // ₹249
    useAppStore.getState().addBalance(100); // not enough

    const draft = useAppStore.getState().createDraft(item, "ORDER");
    const result = useAppStore.getState().authorizeTransaction(draft.id, "wallet");

    expect(result).toEqual({ ok: false, reason: "insufficient_balance" });
    expect(useAppStore.getState().walletBalance).toBe(100); // untouched
    expect(useAppStore.getState().transactions.find((t) => t.id === draft.id)!.status).toBe("draft");
    expect(useAppStore.getState().audit.map((a) => a.action)).toContain("purchase_blocked");
  });
});

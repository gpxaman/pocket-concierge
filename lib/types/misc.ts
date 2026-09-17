// Small, independent profile-adjacent types with no cross-domain
// dependencies — explicit preferences, AI-inferred memory, and the
// append-only audit trail (TRD §23.3).

export interface Preference {
  key: string;
  value: string;
  updatedAt: number;
}

export interface MemoryItem {
  id: string;
  fact: string;
  confidence: number; // 0-1
  provenance: "explicit" | "inferred";
  createdAt: number;
}

export interface AuditRecord {
  id: string;
  actorType: "USER" | "AI_AGENT";
  action: string;
  resourceType: string;
  resourceId?: string;
  policyDecision: "allowed" | "requires_confirmation" | "blocked";
  detail?: string;
  correlationId: string;
  timestamp: number;
}

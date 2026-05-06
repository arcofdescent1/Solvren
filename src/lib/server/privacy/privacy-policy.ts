/**
 * Phase 5 — Single enforcement point for org privacy mode vs data class.
 */
export type PrivacyMode = "minimal" | "expanded";

export type DataClass =
  | "metadata"
  | "operational_event"
  | "pii"
  | "financial_exact"
  | "financial_estimated"
  | "raw_payload"
  | "credential"
  | "write_back";

export type PrivacyAction = "ingest" | "persist" | "display" | "prompt";

export class PrivacyPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrivacyPolicyError";
  }
}

export type AssertPrivacyPolicyInput = {
  mode: PrivacyMode;
  dataClass: DataClass;
  action: PrivacyAction;
  /** Required for financial_exact in expanded mode (admin-gated). */
  expandedFinancialDetailEnabled?: boolean;
};

/**
 * Throws PrivacyPolicyError when the action is not allowed for the org mode.
 */
export function assertPrivacyPolicy(input: AssertPrivacyPolicyInput): void {
  const { mode, dataClass, action, expandedFinancialDetailEnabled } = input;

  const deny = (msg: string) => {
    throw new PrivacyPolicyError(msg);
  };

  switch (dataClass) {
    case "metadata":
      return;
    case "operational_event":
      return;
    case "pii":
      if (action === "ingest" || action === "persist") {
        /* only hash/redact paths allowed — caller must normalize */
        return;
      }
      return;
    case "raw_payload":
      deny("Raw payloads are not stored or processed under Solvren privacy policy");
      return;
    case "credential":
      if (action === "prompt") {
        deny("Credentials must not be sent to prompts");
      }
      return;
    case "financial_estimated":
      return;
    case "financial_exact":
      if (mode === "minimal") {
        deny("Exact financial fields are not allowed in minimal privacy mode");
      }
      if (!expandedFinancialDetailEnabled) {
        deny("Exact financial detail requires expanded mode and admin-enabled financial detail");
      }
      return;
    case "write_back":
      deny("Use write-back policy (requireWriteBackAllowed), not privacy matrix, for mutations");
      return;
    default: {
      const _exhaustive: never = dataClass;
      return _exhaustive;
    }
  }
}

export function parsePrivacyMode(raw: string | null | undefined): PrivacyMode {
  const v = String(raw ?? "minimal").toLowerCase();
  if (v === "expanded") return "expanded";
  return "minimal";
}

export const SuggestEvidenceSchema = {
  name: "suggest_evidence_output",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["version", "missing_kinds", "suggestions"],
    properties: {
      version: { type: "string", enum: ["1.0"] },
      missing_kinds: {
        type: "array",
        minItems: 0,
        maxItems: 12,
        items: {
          type: "string",
          enum: [
            "PR",
            "RUNBOOK",
            "DASHBOARD",
            "ROLLBACK",
            "TEST_PLAN",
            "COMMS_PLAN",
            "OTHER",
          ],
        },
      },
      suggestions: {
        type: "array",
        minItems: 0,
        maxItems: 12,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["kind", "suggested_label", "what_good_looks_like", "example_links"],
          properties: {
            kind: {
              type: "string",
              enum: [
                "PR",
                "RUNBOOK",
                "DASHBOARD",
                "ROLLBACK",
                "TEST_PLAN",
                "COMMS_PLAN",
                "OTHER",
              ],
            },
            suggested_label: { type: "string", minLength: 1, maxLength: 120 },
            what_good_looks_like: {
              type: "array",
              minItems: 1,
              maxItems: 6,
              items: { type: "string", minLength: 1, maxLength: 160 },
            },
            example_links: {
              type: "array",
              minItems: 0,
              maxItems: 5,
              items: { type: "string", minLength: 1, maxLength: 160 },
            },
          },
        },
      },
    },
  },
} as const;

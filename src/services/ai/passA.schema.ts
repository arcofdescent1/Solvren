export const PassASchema = {
  name: "pass_a_output",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["version", "summary", "signals"],
    properties: {
      version: { type: "string", enum: ["1.0"] },

      summary: {
        type: "object",
        additionalProperties: false,
        required: ["risk_narrative", "key_concerns"],
        properties: {
          risk_narrative: { type: "string", minLength: 1, maxLength: 600 },
          key_concerns: {
            type: "array",
            minItems: 1,
            maxItems: 8,
            items: { type: "string", minLength: 1, maxLength: 140 },
          },
        },
      },

      signals: {
        type: "array",
        minItems: 0,
        maxItems: 30,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "signal_key",
            "value_type",
            "value",
            "confidence",
            "category",
            "reason",
          ],
          properties: {
            signal_key: { type: "string", minLength: 2, maxLength: 80 },

            value_type: {
              type: "string",
              enum: ["BOOLEAN", "NUMBER", "TEXT"],
            },

            value: {
              oneOf: [
                { type: "boolean" },
                { type: "number" },
                { type: "string", minLength: 1, maxLength: 500 },
              ],
            },

            confidence: { type: "number", minimum: 0, maximum: 1 },

            category: {
              type: "string",
              enum: [
                "FINANCIAL_EXPOSURE",
                "DATA_INTEGRITY",
                "REPORTING_ACCURACY",
                "CUSTOMER_IMPACT",
                "AUTOMATION_INTEGRATION",
                "ROLLBACK_COMPLEXITY",
              ],
            },

            reason: { type: "string", minLength: 1, maxLength: 240 },

            evidence_refs: {
              type: "array",
              minItems: 0,
              maxItems: 6,
              items: { type: "string", minLength: 1, maxLength: 120 },
            },
          },
        },
      },

      checklist_md_suggestion: {
        type: "string",
        minLength: 0,
        maxLength: 5000,
      },
    },
  },
} as const;

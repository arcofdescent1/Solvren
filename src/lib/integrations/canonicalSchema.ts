/**
 * Phase 1 — Canonical object schemas.
 * Source schemas are decoupled from internal logic. All ingestion flows produce canonical objects.
 */

export type CanonicalFieldType = "string" | "number" | "date" | "boolean" | "object" | "array";

export type CanonicalObjectSchema = {
  required: string[];
  fields: Record<string, CanonicalFieldType>;
};

export const CanonicalSchemas = {
  Customer: {
    required: ["externalId"],
    fields: {
      externalId: "string",
      email: "string",
      firstName: "string",
      lastName: "string",
      phone: "string",
      companyName: "string",
      createdAt: "date",
      updatedAt: "date",
      status: "string",
    },
  } satisfies CanonicalObjectSchema,

  Account: {
    required: ["externalId"],
    fields: {
      externalId: "string",
      name: "string",
      domain: "string",
      industry: "string",
      createdAt: "date",
      updatedAt: "date",
      status: "string",
    },
  } satisfies CanonicalObjectSchema,

  Transaction: {
    required: ["externalId", "amount", "currency", "occurredAt"],
    fields: {
      externalId: "string",
      amount: "number",
      currency: "string",
      occurredAt: "date",
      status: "string",
      customerExternalId: "string",
      accountExternalId: "string",
      createdAt: "date",
      updatedAt: "date",
    },
  } satisfies CanonicalObjectSchema,

  Event: {
    required: ["externalId", "occurredAt"],
    fields: {
      externalId: "string",
      type: "string",
      occurredAt: "date",
      customerExternalId: "string",
      accountExternalId: "string",
      metadata: "object",
      createdAt: "date",
    },
  } satisfies CanonicalObjectSchema,

  FunnelStep: {
    required: ["externalId", "stage", "occurredAt"],
    fields: {
      externalId: "string",
      stage: "string",
      occurredAt: "date",
      amount: "number",
      currency: "string",
      customerExternalId: "string",
      accountExternalId: "string",
      metadata: "object",
    },
  } satisfies CanonicalObjectSchema,

  IssueSignal: {
    required: ["externalId", "signalType"],
    fields: {
      externalId: "string",
      signalType: "string",
      severity: "string",
      occurredAt: "date",
      metadata: "object",
    },
  } satisfies CanonicalObjectSchema,
} as const;

export type CanonicalObjectType = keyof typeof CanonicalSchemas;

export function getCanonicalSchema(type: CanonicalObjectType): CanonicalObjectSchema {
  const schema = CanonicalSchemas[type];
  if (!schema) throw new Error(`Unknown canonical type: ${type}`);
  return schema;
}

export function getCanonicalFields(type: CanonicalObjectType): string[] {
  return Object.keys(getCanonicalSchema(type).fields);
}

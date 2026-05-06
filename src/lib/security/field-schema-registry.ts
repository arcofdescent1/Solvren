/**
 * Phase 2 — Dot-path field schemas for ingestion (exact and * wildcard segments).
 */

import type { FieldClassification } from "./data-classification";

/** Dot-path keys, e.g. "contact.email", "metadata.*.token", "properties.amount". */
export type FieldSchema = Record<string, FieldClassification>;

const GENERIC_FALLBACK: FieldClassification = {
  sensitivity: "CUSTOMER_CONFIDENTIAL",
  handling: "REDACT",
};

/** HubSpot-style CRM payloads (conservative defaults). */
export const HUBSPOT_SCHEMA: FieldSchema = {
  "email": { sensitivity: "PII", handling: "HASH" },
  "firstname": { sensitivity: "PII", handling: "REDACT" },
  "lastname": { sensitivity: "PII", handling: "REDACT" },
  "phone": { sensitivity: "PII", handling: "REDACT" },
  "properties.email": { sensitivity: "PII", handling: "HASH" },
  "properties.firstname": { sensitivity: "PII", handling: "REDACT" },
  "properties.lastname": { sensitivity: "PII", handling: "REDACT" },
  "properties.phone": { sensitivity: "PII", handling: "REDACT" },
  "properties.amount": { sensitivity: "FINANCIAL", handling: "ALLOW" },
  "amount": { sensitivity: "FINANCIAL", handling: "ALLOW" },
  "dealname": { sensitivity: "CUSTOMER_CONFIDENTIAL", handling: "REDACT" },
  "properties.dealname": { sensitivity: "CUSTOMER_CONFIDENTIAL", handling: "REDACT" },
};

export const STRIPE_SCHEMA: FieldSchema = {
  "customer": { sensitivity: "CUSTOMER_CONFIDENTIAL", handling: "REDACT" },
  "customer_email": { sensitivity: "PII", handling: "HASH" },
  "email": { sensitivity: "PII", handling: "HASH" },
  "data.object.customer_email": { sensitivity: "PII", handling: "HASH" },
  "data.object.amount": { sensitivity: "FINANCIAL", handling: "ALLOW" },
  "data.object.amount_due": { sensitivity: "FINANCIAL", handling: "ALLOW" },
  "data.object.total": { sensitivity: "FINANCIAL", handling: "ALLOW" },
};

export const SLACK_SCHEMA: FieldSchema = {
  "user_id": { sensitivity: "INTERNAL", handling: "ALLOW" },
  "user.name": { sensitivity: "PII", handling: "REDACT" },
  "user.email": { sensitivity: "PII", handling: "HASH" },
  "text": { sensitivity: "CUSTOMER_CONFIDENTIAL", handling: "REDACT" },
  "message.text": { sensitivity: "CUSTOMER_CONFIDENTIAL", handling: "REDACT" },
};

export const GITHUB_SCHEMA: FieldSchema = {
  "sender.email": { sensitivity: "PII", handling: "HASH" },
  "sender.login": { sensitivity: "INTERNAL", handling: "ALLOW" },
  "pusher.email": { sensitivity: "PII", handling: "HASH" },
  "repository.full_name": { sensitivity: "CUSTOMER_CONFIDENTIAL", handling: "REDACT" },
};

export const JIRA_SCHEMA: FieldSchema = {
  "user.emailAddress": { sensitivity: "PII", handling: "HASH" },
  "user.displayName": { sensitivity: "PII", handling: "REDACT" },
  "issue.fields.summary": { sensitivity: "CUSTOMER_CONFIDENTIAL", handling: "REDACT" },
};

const PROVIDER_SCHEMAS: Record<string, FieldSchema> = {
  hubspot: HUBSPOT_SCHEMA,
  stripe: STRIPE_SCHEMA,
  slack: SLACK_SCHEMA,
  github: GITHUB_SCHEMA,
  jira: JIRA_SCHEMA,
};

export function mergeFieldSchemas(...schemas: FieldSchema[]): FieldSchema {
  return Object.assign({}, ...schemas);
}

export function getFieldSchema(provider: string): FieldSchema {
  const key = provider.trim().toLowerCase();
  const specific = PROVIDER_SCHEMAS[key];
  return specific ? mergeFieldSchemas(specific) : {};
}

export function getFallbackClassification(): FieldClassification {
  return { ...GENERIC_FALLBACK };
}

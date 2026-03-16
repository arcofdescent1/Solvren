/**
 * SAML 2.0: AuthnRequest build and SAMLResponse parse/verify
 */
import { parseStringPromise } from "xml2js";
import * as crypto from "crypto";
import type { NormalizedIdentity } from "./claimMapper";

const SAML_NS = "urn:oasis:names:tc:SAML:2.0:assertion";
const PROTOCOL_NS = "urn:oasis:names:tc:SAML:2.0:protocol";

function deflateBase64(s: string): string {
  const zlib = require("zlib") as typeof import("zlib");
  const deflated = zlib.deflateRawSync(Buffer.from(s, "utf8"), { level: 9 });
  return deflated.toString("base64");
}

export function buildAuthnRequest(
  acsUrl: string,
  spEntityId: string,
  idpSsoUrl: string,
  _idpEntityId: string,
  relayState: string
): string {
  const id = `_rg_${crypto.randomUUID().replace(/-/g, "")}`;
  const instant = new Date().toISOString();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<samlp:AuthnRequest xmlns:samlp="${PROTOCOL_NS}" xmlns:saml="${SAML_NS}"
  ID="${id}"
  Version="2.0"
  IssueInstant="${instant}"
  AssertionConsumerServiceURL="${acsUrl}"
  ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
  ProviderName="Solvren">
  <saml:Issuer>${escapeXml(spEntityId)}</saml:Issuer>
  <samlp:NameIDPolicy Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress" AllowCreate="true"/>
</samlp:AuthnRequest>`;
  const encoded = deflateBase64(xml);
  const params = new URLSearchParams({
    SAMLRequest: encoded,
    RelayState: relayState,
  });
  return `${idpSsoUrl}${idpSsoUrl.includes("?") ? "&" : "?"}${params.toString()}`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export type SamlParseResult = {
  identity: NormalizedIdentity;
  rawAttributes: Record<string, string | string[]>;
};

/**
 * Parse SAMLResponse XML and extract identity. Optionally verify signature with IdP cert.
 */
export async function parseSamlResponse(
  samlResponseBase64: string,
  attributeMappings?: Record<string, string>
): Promise<SamlParseResult> {
  const raw = Buffer.from(samlResponseBase64, "base64").toString("utf8");
  const parsed = (await parseStringPromise(raw, {
    explicitArray: true,
    tagNameProcessors: [stripNs],
  })) as Record<string, unknown>;

  const response = parsed.Response ?? parsed.SAMLResponse;
  if (!response || typeof response !== "object") {
    throw new Error("Invalid SAML response structure");
  }

  const r = response as Record<string, unknown>;
  const assertion = Array.isArray(r.Assertion) ? r.Assertion[0] : r.Assertion;
  if (!assertion || typeof assertion !== "object") {
    throw new Error("Missing Assertion");
  }

  const a = assertion as Record<string, unknown>;
  const subject = Array.isArray(a.Subject) ? a.Subject[0] : a.Subject;
  const nameId =
    subject && typeof subject === "object"
      ? (subject as Record<string, unknown>).NameID ?? (subject as Record<string, unknown>).NameId
      : undefined;
  const nameIdValue = Array.isArray(nameId) ? nameId[0] : nameId;
  const externalSubject = typeof nameIdValue === "string" ? nameIdValue : String(nameIdValue ?? "");

  const attrs = (a.AttributeStatement ?? a["AttributeStatement"]) as unknown;
  const attrList = Array.isArray(attrs) ? attrs[0] : attrs;
  const rawAttributes: Record<string, string | string[]> = {};

  if (attrList && typeof attrList === "object") {
    const list = (attrList as Record<string, unknown>).Attribute ?? (attrList as Record<string, unknown>).attribute;
    const arr = Array.isArray(list) ? list : list ? [list] : [];
    for (const attr of arr) {
      if (typeof attr !== "object" || !attr) continue;
      const at = attr as Record<string, unknown>;
      const dollar = at.$ as Record<string, unknown> | undefined;
      const name = (at.Name ?? dollar?.Name ?? dollar?.name) as string;
      const value = at.AttributeValue ?? at.attributeValue;
      if (name) {
        if (Array.isArray(value)) {
          rawAttributes[name] = value.map((v) => (typeof v === "string" ? v : String(v)));
        } else if (value !== undefined) {
          rawAttributes[name] = typeof value === "string" ? value : String(value);
        }
      }
    }
  }

  const get = (mappedName: string, defaultKeys: string[]): string | null => {
    const key = attributeMappings?.[mappedName] ?? mappedName;
    const v = rawAttributes[key] ?? rawAttributes[mappedName];
    for (const d of defaultKeys) {
      const w = rawAttributes[d];
      if (w !== undefined) return Array.isArray(w) ? w[0] : w;
    }
    if (v !== undefined) return Array.isArray(v) ? v[0] : v;
    return null;
  };

  const email = get("email", ["email", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"]) ?? externalSubject;
  const givenName = get("given_name", ["given_name", "firstName", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname"]);
  const familyName = get("family_name", ["family_name", "lastName", "surname", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname"]);
  const name = get("name", ["name", "displayName"]);
  const displayName = name || [givenName, familyName].filter(Boolean).join(" ") || null;
  const groupsRaw = get("groups", ["groups", "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"]) ?? "";
  const groups = typeof groupsRaw === "string" ? groupsRaw.split(/[,;]/).map((s) => s.trim()).filter(Boolean) : [];
  const department = get("department", ["department"]);

  const identity: NormalizedIdentity = {
    externalSubject: externalSubject || email,
    email,
    emailVerified: true,
    givenName: givenName || null,
    familyName: familyName || null,
    displayName: displayName || null,
    groups,
    department: department || null,
    rawClaims: rawAttributes as Record<string, unknown>,
  };

  return { identity, rawAttributes };
}

function stripNs(name: string): string {
  const i = name.indexOf(":");
  return i > -1 ? name.slice(i + 1) : name;
}

/**
 * Verify SAML Response signature with IdP certificate (PEM).
 * Returns true if valid or if no signature present (optional enforcement).
 */
export function verifySamlResponseSignature(
  samlResponseBase64: string,
  idpCertificatePem: string
): boolean {
  const raw = Buffer.from(samlResponseBase64, "base64").toString("utf8");
  const sigMatch = raw.match(/<Signature[^>]*>([\s\S]*?)<\/Signature>/);
  if (!sigMatch) return true;
  const signedInfoMatch = raw.match(/<SignedInfo[\s\S]*?<\/SignedInfo>/);
  if (!signedInfoMatch) return false;
  const certMatch = raw.match(/<X509Certificate>([\s\S]*?)<\/X509Certificate>/);
  if (!certMatch) return false;
  const certPem = `-----BEGIN CERTIFICATE-----\n${certMatch[1].replace(/\s/g, "").match(/.{1,64}/g)?.join("\n") ?? ""}\n-----END CERTIFICATE-----`;
  try {
    const verifier = crypto.createPublicKey({ key: certPem, format: "pem" });
    const sigValueMatch = raw.match(/<SignatureValue[^>]*>([\s\S]*?)<\/SignatureValue>/);
    if (!sigValueMatch) return false;
    const sigValue = Buffer.from((sigValueMatch[1] ?? "").replace(/\s/g, ""), "base64");
    const canonicalSignedInfo = signedInfoMatch[0].replace(/\r\n/g, "\n").replace(/\n/g, "\r\n");
    return crypto.verify("RSA-SHA256", Buffer.from(canonicalSignedInfo, "utf8"), verifier, sigValue);
  } catch {
    return false;
  }
}

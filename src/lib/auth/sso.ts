/**
 * Phase 4 — SSO abstraction layer.
 * Provides a unified interface over SAML and OIDC providers.
 * SSO must not break RLS, org scoping, or RBAC.
 *
 * Implementations:
 * - SAML: src/services/sso/saml.ts
 * - OIDC: src/services/sso/oidc.ts
 * - Completion: src/services/sso/completeSsoLogin.ts
 */
import type { NormalizedIdentity } from "@/services/sso/claimMapper";

/** Supported SSO protocols */
export type SsoProtocol = "saml" | "oidc";

/** Normalized identity from IdP claims (external user → internal user mapping) */
export type { NormalizedIdentity };

/**
 * SSO provider configuration (abstract).
 * Maps to sso_providers table; implementations resolve protocol-specific fields.
 */
export type SsoProviderConfig = {
  id: string;
  orgId: string;
  protocol: SsoProtocol;
  enabled: boolean;
  /** SAML: IdP SSO URL */
  samlSsoUrl?: string;
  /** SAML: IdP entity ID */
  samlEntityId?: string;
  /** OIDC: Issuer URL for discovery */
  oidcIssuer?: string;
  /** OIDC: Client ID */
  oidcClientId?: string;
  /** OIDC: Client secret (encrypted) */
  oidcClientSecretRef?: string;
};

/**
 * Start SSO flow — returns redirect URL to IdP.
 * Protocol-specific implementations handle AuthnRequest (SAML) or authorization URL (OIDC).
 */
export type StartSsoFlowParams = {
  orgId: string;
  providerId: string;
  successRedirectUrl?: string;
  failureRedirectUrl?: string;
};

export type StartSsoFlowResult =
  | { ok: true; redirectUrl: string }
  | { ok: false; error: string };

/**
 * Complete SSO login after IdP callback.
 * Resolves external user → internal user; ensures membership; issues session.
 * Preserves RLS and org scoping.
 */
export type CompleteSsoLoginParams = {
  orgId: string;
  providerId: string;
  identity: NormalizedIdentity;
  protocol: SsoProtocol;
  allowJit: boolean;
  successRedirectUrl?: string;
};

export type CompleteSsoLoginResult =
  | { ok: true; redirectUrl: string }
  | { ok: false; failureReason: string };

// Re-export implementations for use by routes.
// Routes call services/sso/* directly; this module provides the abstraction contract.
export {
  buildAuthnRequest,
  parseSamlResponse,
  type SamlParseResult,
} from "@/services/sso/saml";
export {
  fetchOidcDiscovery,
  exchangeCodeForTokens,
  validateIdToken,
  buildAuthorizeUrl,
  type OidcEndpoints,
} from "@/services/sso/oidc";
export {
  completeSsoLogin,
  type CompleteSsoLoginParams as CompleteSsoParams,
  type CompleteSsoLoginResult as CompleteSsoResult,
} from "@/services/sso/completeSsoLogin";
export {
  normalizeOidcClaims,
  type NormalizedIdentity as SsoNormalizedIdentity,
} from "@/services/sso/claimMapper";
export { resolveRoleFromMappings } from "@/services/sso/roleMapping";

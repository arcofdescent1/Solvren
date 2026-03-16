/**
 * Salesforce REST API client: SOQL, identity, limits.
 * IES §13
 */

import {
  getAccessTokenClientCredentials,
  getAccessTokenJwt,
  type TokenResult,
} from "./SalesforceAuthService";
import { env } from "@/lib/env";

export type SalesforceClientOptions = {
  environment: "production" | "sandbox";
  instanceUrl?: string;
  clientId: string;
  clientSecret: string;
  authMode: "jwt_bearer" | "client_credentials";
  username?: string;
  jwtPrivateKeyBase64?: string;
};

export class SalesforceClient {
  private tokenPromise: Promise<TokenResult> | null = null;
  private _instanceUrl: string | null = null;

  constructor(private readonly opts: SalesforceClientOptions) {}

  private async getToken(): Promise<TokenResult> {
    if (this.tokenPromise) return this.tokenPromise;
    if (this.opts.authMode === "jwt_bearer" && this.opts.username && this.opts.jwtPrivateKeyBase64) {
      this.tokenPromise = getAccessTokenJwt(
        this.opts.environment,
        this.opts.clientId,
        this.opts.username,
        this.opts.jwtPrivateKeyBase64
      );
    } else {
      this.tokenPromise = getAccessTokenClientCredentials(
        this.opts.environment,
        this.opts.clientId,
        this.opts.clientSecret
      );
    }
    return this.tokenPromise;
  }

  private async getHeaders(): Promise<Record<string, string>> {
    const { accessToken } = await this.getToken();
    return {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };
  }

  private get baseUrl(): string {
    if (this._instanceUrl) return this._instanceUrl;
    if (this.opts.instanceUrl) return this.opts.instanceUrl;
    throw new Error("Instance URL not yet available; call getToken() first");
  }

  private async ensureBaseUrl(): Promise<void> {
    const t = await this.getToken();
    if (t.instanceUrl && !this._instanceUrl) this._instanceUrl = t.instanceUrl;
    if (!this._instanceUrl && this.opts.instanceUrl) this._instanceUrl = this.opts.instanceUrl;
  }

  private get apiVersion(): string {
    const v = env.salesforceApiVersion;
    return v.startsWith("v") ? v : `v${v}`;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    await this.ensureBaseUrl();
    const headers = await this.getHeaders();
    const url = `${this.baseUrl}/services/data/${this.apiVersion}${path.startsWith("/") ? path : `/${path}`}`;
    const res = await fetch(url, {
      ...init,
      headers: { ...headers, ...(init?.headers as Record<string, string>) },
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string; error_description?: string };
    if (!res.ok) {
      throw new Error(
        (data as { error_description?: string }).error_description ??
          (data as { error?: string }).error ??
          `Salesforce API: ${res.status}`
      );
    }
    return data;
  }

  /**
   * Execute SOQL query.
   */
  async executeSoql<T = Record<string, unknown>>(
    query: string
  ): Promise<{ records: T[]; totalSize: number; done: boolean }> {
    const encoded = encodeURIComponent(query);
    const data = (await this.request<{
      totalSize: number;
      done: boolean;
      records: T[];
    }>(`/query?q=${encoded}`)) as { totalSize: number; done: boolean; records: T[] };
    return {
      records: data.records ?? [],
      totalSize: data.totalSize ?? 0,
      done: data.done ?? true,
    };
  }

  /**
   * Lightweight connectivity test: run simple SOQL.
   */
  async testConnection(): Promise<void> {
    const { records } = await this.executeSoql("SELECT Id FROM User LIMIT 1");
    if (!Array.isArray(records) || records.length === 0) {
      throw new Error("No User record returned; check object permissions");
    }
  }

  /**
   * List all sobjects (metadata). Returns { sobjects: Array<{ name: string; label: string; ... }> }.
   */
  async listSobjects(): Promise<{ sobjects: Array<{ name: string; label: string; custom: boolean }> }> {
    const data = (await this.request<{ sobjects?: Array<{ name: string; label: string; custom?: boolean }> }>("/sobjects")) as {
      sobjects?: Array<{ name: string; label: string; custom?: boolean }>;
    };
    const list = data.sobjects ?? [];
    return {
      sobjects: list.map((s) => ({
        name: s.name,
        label: s.label ?? s.name,
        custom: s.custom ?? false,
      })),
    };
  }

  /**
   * Describe an sobject to get field metadata.
   */
  async describeSobject(sobjectName: string): Promise<{
    fields: Array<{ name: string; label: string; type: string }>;
  }> {
    const data = (await this.request<{ fields?: Array<{ name: string; label: string; type: string }> }>(
      `/sobjects/${encodeURIComponent(sobjectName)}/describe`
    )) as { fields?: Array<{ name: string; label: string; type: string }> };
    const fields = data.fields ?? [];
    return {
      fields: fields.map((f) => ({ name: f.name, label: f.label ?? f.name, type: f.type ?? "string" })),
    };
  }
}

/**
 * NetSuite REST Web Services + SuiteQL client.
 */

import { getAccessToken } from "./NetSuiteAuthService";
import { env } from "@/lib/env";

function getBaseUrl(accountId: string): string {
  const t = env.netsuiteApiBaseUrlTemplate;
  return t.replace("{accountId}", accountId);
}

export type NetSuiteClientOptions = {
  accountId: string;
  clientId: string;
  clientSecret: string;
};

export class NetSuiteClient {
  constructor(private readonly opts: NetSuiteClientOptions) {}

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await getAccessToken(
      this.opts.accountId,
      this.opts.clientId,
      this.opts.clientSecret
    );
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };
  }

  /**
   * Execute SuiteQL query.
   */
  async executeSuiteQL(q: string, limit = env.netsuiteDefaultQueryPageSize): Promise<{
    items: Array<Record<string, unknown>>;
    totalResults?: number;
    hasMore?: boolean;
  }> {
    const baseUrl = getBaseUrl(this.opts.accountId);
    const url = `${baseUrl}/query/v1/suiteql?limit=${limit}&offset=0`;
    const headers = await this.getAuthHeaders();

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ q }),
    });

    const data = (await res.json()) as {
      items?: Array<Record<string, unknown>>;
      totalResults?: number;
      count?: number;
      hasMore?: boolean;
      links?: Array<{ rel: string; href: string }>;
      error?: { code?: string; message?: string };
    };

    if (!res.ok) {
      throw new Error(data.error?.message ?? `SuiteQL failed: ${res.status}`);
    }

    return {
      items: data.items ?? [],
      totalResults: data.totalResults ?? data.count,
      hasMore: data.hasMore ?? false,
    };
  }

  /**
   * Lightweight REST record GET for connectivity test.
   */
  async getRecord(
    recordType: string,
    internalId: string
  ): Promise<Record<string, unknown>> {
    const baseUrl = getBaseUrl(this.opts.accountId);
    const url = `${baseUrl}/record/v1/${recordType}/${internalId}`;
    const headers = await this.getAuthHeaders();

    const res = await fetch(url, { headers });
    const data = (await res.json()) as Record<string, unknown>;

    if (!res.ok) {
      throw new Error((data as { o: { error: { message?: string } } }).o?.error?.message ?? `REST GET failed: ${res.status}`);
    }

    return data;
  }

  /**
   * Minimal SuiteQL for connectivity test.
   */
  async testSuiteQL(): Promise<void> {
    await this.executeSuiteQL("SELECT 1 AS one FROM dual", 1);
  }
}

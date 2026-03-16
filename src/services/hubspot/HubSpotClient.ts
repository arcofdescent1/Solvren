/**
 * HubSpot REST API client for CRM objects.
 * IES §14
 */

import { env } from "@/lib/env";

export type HubSpotClientOptions = {
  accessToken: string;
};

export class HubSpotClient {
  constructor(private readonly opts: HubSpotClientOptions) {}

  private get baseUrl(): string {
    return env.hubspotApiBaseUrl;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = path.startsWith("http") ? path : `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.opts.accessToken}`,
        "Content-Type": "application/json",
        ...(init?.headers as Record<string, string>),
      },
    });
    const data = (await res.json().catch(() => ({}))) as T & { status?: string; message?: string };
    if (!res.ok) {
      throw new Error((data as { message?: string }).message ?? `HubSpot API: ${res.status}`);
    }
    return data;
  }

  /**
   * Get account/portal info (works with OAuth and private-app tokens).
   */
  async getAccountInfo(): Promise<{ portalId: number; timeZone?: string }> {
    const data = (await this.request<{ portalId?: number; timeZone?: string }>("/account-info/v3/details")) as {
      portalId?: number;
      timeZone?: string;
    };
    if (data.portalId == null) throw new Error("Could not determine portal ID");
    return { portalId: data.portalId, timeZone: data.timeZone };
  }

  /**
   * Fetch contacts (or any CRM object) - lightweight test.
   */
  async searchContacts(limit = 1): Promise<{ total?: number; results: unknown[] }> {
    const data = (await this.request<{ total?: number; results?: unknown[] }>("/crm/v3/objects/contacts/search", {
      method: "POST",
      body: JSON.stringify({
        limit,
        filterGroups: [],
        sorts: [{ propertyName: "createdate", direction: "DESCENDING" }],
      }),
    })) as { total?: number; results?: unknown[] };
    return { total: data.total, results: data.results ?? [] };
  }

  /**
   * Search CRM objects (contacts, companies, deals, etc).
   */
  async searchCrmObjects(
    objectType: string,
    opts: { limit?: number; filterGroups?: unknown[]; sorts?: { propertyName: string; direction: string }[] } = {}
  ): Promise<{ total?: number; results: unknown[] }> {
    const data = (await this.request<{ total?: number; results?: unknown[] }>(
      `/crm/v3/objects/${objectType}/search`,
      {
        method: "POST",
        body: JSON.stringify({
          limit: opts.limit ?? 100,
          filterGroups: opts.filterGroups ?? [],
          sorts: opts.sorts ?? [{ propertyName: "createdate", direction: "DESCENDING" }],
        }),
      }
    )) as { total?: number; results?: unknown[] };
    return { total: data.total, results: data.results ?? [] };
  }

  /**
   * Get properties for an object type (e.g. deals, contacts, companies).
   */
  async getObjectProperties(objectType: string): Promise<{
    properties: Array<{ name: string; label: string; type: string }>;
  }> {
    const data = (await this.request<{
      results?: Array<{ name: string; label: string; type: string }>;
    }>(`/crm/v3/properties/${objectType}`)) as { results?: Array<{ name: string; label: string; type: string }> };
    const list = data.results ?? [];
    return {
      properties: list.map((p) => ({ name: p.name, label: p.label ?? p.name, type: p.type ?? "string" })),
    };
  }

  /**
   * Lightweight connectivity test.
   */
  async testConnection(): Promise<void> {
    const info = await this.getAccountInfo();
    if (info.portalId == null) throw new Error("No portal ID returned");
    const { results } = await this.searchContacts(1);
    if (!Array.isArray(results)) throw new Error("Unexpected CRM response");
  }
}

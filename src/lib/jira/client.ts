/**
 * Jira Cloud REST API client.
 * Uses OAuth access token from integration_credentials.
 */

const JIRA_API_BASE = "https://api.atlassian.com/ex/jira";

export async function jiraGet<T>(
  cloudId: string,
  accessToken: string,
  path: string
): Promise<T> {
  const url = `${JIRA_API_BASE}/${cloudId}/rest/api/3${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jira API error ${res.status}: ${text.slice(0, 500)}`);
  }
  return res.json();
}

export async function jiraPost<T>(
  cloudId: string,
  accessToken: string,
  path: string,
  body: unknown
): Promise<T> {
  const url = `${JIRA_API_BASE}/${cloudId}/rest/api/3${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jira API error ${res.status}: ${text.slice(0, 500)}`);
  }
  if (res.status === 204) return {} as T;
  return res.json();
}

export async function jiraPut(
  cloudId: string,
  accessToken: string,
  path: string,
  body: unknown
): Promise<void> {
  const url = `${JIRA_API_BASE}/${cloudId}/rest/api/3${path}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jira API error ${res.status}: ${text.slice(0, 500)}`);
  }
}

export async function jiraDelete(
  cloudId: string,
  accessToken: string,
  path: string
): Promise<void> {
  const url = `${JIRA_API_BASE}/${cloudId}/rest/api/3${path}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
  if (!res.ok && res.status !== 204) {
    const text = await res.text();
    throw new Error(`Jira API error ${res.status}: ${text.slice(0, 500)}`);
  }
}

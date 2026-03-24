/**
 * Soft-delete scope for change_events — use on every user-scoped query (SSR client).
 * Service-role jobs that must include tombstones must NOT apply this filter.
 */
export function scopeActiveChangeEvents<Q extends { is: (column: string, value: null) => Q }>(query: Q): Q {
  return query.is("deleted_at", null);
}

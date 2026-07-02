// Pure query/response helpers for GET /api/history, extracted from routes.ts so
// the parameter normalization and response shaping can be unit-tested without a
// database or Express (issue #13, item 3). Behaviour is identical to the prior
// inline logic — this is a refactor, not a behaviour change.

export interface HistoryQueryParams {
  page: number;
  limit: number;
  search?: string;
}

export const HISTORY_DEFAULT_LIMIT = 50;
export const HISTORY_MAX_LIMIT = 500;

// Normalize raw request query params into a safe { page, limit, search }:
//   page  — >= 1, defaults to 1 (NaN / out-of-range -> 1)
//   limit — clamped to [1, 500], defaults to 50
//   search — trimmed non-empty string, otherwise undefined
export function parseHistoryQuery(query: {
  page?: unknown;
  limit?: unknown;
  search?: unknown;
}): HistoryQueryParams {
  const rawPage = parseInt(String(query.page || "1"), 10);
  const rawLimit = parseInt(String(query.limit || String(HISTORY_DEFAULT_LIMIT)), 10);
  const page = isNaN(rawPage) ? 1 : Math.max(1, rawPage);
  const limit = isNaN(rawLimit)
    ? HISTORY_DEFAULT_LIMIT
    : Math.min(HISTORY_MAX_LIMIT, Math.max(1, rawLimit));
  const search =
    typeof query.search === "string" && query.search.trim()
      ? query.search.trim()
      : undefined;
  return { page, limit, search };
}

export interface HistoryResult<T> {
  items: T[];
  total: number;
}

// Shape the paginated response exactly as the route returned it before.
export function buildHistoryResponse<T>(
  result: HistoryResult<T>,
  page: number,
  limit: number,
): HistoryResult<T> & { page: number; limit: number; totalPages: number } {
  return {
    items: result.items,
    total: result.total,
    page,
    limit,
    totalPages: Math.ceil(result.total / limit),
  };
}

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
  take: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function parsePagination(query: { page?: unknown; limit?: unknown }): PaginationParams {
  const parsedPage = Number(query.page);
  const parsedLimit = Number(query.limit);

  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  let limit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : 20;

  // Enforce sensible max limit to prevent denial-of-service through giant queries
  if (limit > 100) {
    limit = 100;
  }

  const skip = (page - 1) * limit;
  const take = limit;

  return { page, limit, skip, take };
}

export function formatPaginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResult<T> {
  return {
    data: items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

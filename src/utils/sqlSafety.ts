/**
 * SQL Safety Utilities
 *
 * Provides safe handling of dynamic SQL parameters to prevent SQL injection.
 */

/**
 * Sanitize sort order to prevent SQL injection
 *
 * @param sortOrder - User-provided sort order
 * @param defaultOrder - Default sort order if invalid ('asc' or 'desc')
 * @returns Safe sort order string
 */
export function sanitizeSortOrder(
  sortOrder: string | undefined,
  defaultOrder: 'asc' | 'desc' = 'desc'
): 'asc' | 'desc' {
  if (!sortOrder) {
    return defaultOrder;
  }

  const normalized = sortOrder.toLowerCase();
  if (normalized === 'asc' || normalized === 'desc') {
    return normalized;
  }

  return defaultOrder;
}

/**
 * Sanitize sort column to prevent SQL injection
 *
 * @param sortBy - User-provided column name
 * @param allowedColumns - Whitelist of allowed column names
 * @param defaultColumn - Default column if invalid
 * @returns Safe column name from whitelist
 */
export function sanitizeSortColumn(
  sortBy: string | undefined,
  allowedColumns: readonly string[],
  defaultColumn: string
): string {
  if (!sortBy) {
    return defaultColumn;
  }

  // Check if column is in whitelist
  if (allowedColumns.includes(sortBy)) {
    return sortBy;
  }

  // Not in whitelist, use default
  return defaultColumn;
}

/**
 * Validate and sanitize pagination parameters
 *
 * @param pagination - User-provided pagination object
 * @param allowedSortColumns - Whitelist of allowed sort columns
 * @param defaults - Default values
 * @returns Sanitized pagination parameters
 */
export function sanitizePaginationParams(
  pagination: {
    sortBy?: string;
    sortOrder?: string;
    limit?: number;
    cursor?: string;
  } | undefined,
  allowedSortColumns: readonly string[],
  defaults: {
    sortBy: string;
    sortOrder: 'asc' | 'desc';
    limit: number;
  } = {
      sortBy: 'created_at',
      sortOrder: 'desc',
      limit: 20,
    }
): {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  limit: number;
  cursor?: string;
} {
  const sortBy = sanitizeSortColumn(
    pagination?.sortBy,
    allowedSortColumns,
    defaults.sortBy
  );

  const sortOrder = sanitizeSortOrder(
    pagination?.sortOrder,
    defaults.sortOrder
  );

  // Validate limit (prevent memory exhaustion)
  let limit = pagination?.limit || defaults.limit;
  if (limit < 1 || limit > 100) {
    limit = defaults.limit;
  }

  return {
    sortBy,
    sortOrder,
    limit,
    cursor: pagination?.cursor,
  };
}

/**
 * Common allowed sort columns for different entities
 */
export const COMMON_SORT_COLUMNS = {
  timestamps: ['created_at', 'updated_at'] as const,
  user: ['created_at', 'updated_at', 'email', 'full_name'] as const,
  project: ['created_at', 'updated_at', 'title', 'status', 'type'] as const,
  credit: ['created_at', 'updated_at', 'quantity', 'status', 'vintage_year', 'issued_at'] as const,
  transaction: ['created_at', 'updated_at', 'completed_at', 'quantity', 'status'] as const,
  verification: ['created_at', 'updated_at', 'submitted_at', 'reviewed_at', 'status'] as const,
};

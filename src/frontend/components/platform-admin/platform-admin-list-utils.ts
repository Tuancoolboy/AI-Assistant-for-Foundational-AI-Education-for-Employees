export function clampPage(page: number, totalPages: number): number {
  if (totalPages <= 0) return 1;
  return Math.min(Math.max(page, 1), totalPages);
}

export function paginateItems<T>(items: T[], page: number, pageSize: number) {
  const safePageSize = Math.max(1, pageSize);
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const currentPage = clampPage(page, totalPages);
  const start = (currentPage - 1) * safePageSize;
  const end = start + safePageSize;
  return {
    items: items.slice(start, end),
    page: currentPage,
    pageSize: safePageSize,
    totalItems,
    totalPages,
    start,
    end: Math.min(end, totalItems),
  };
}

export function rangeLabel(start: number, end: number, total: number): string {
  if (total === 0) return "0";
  return `${start + 1}-${end} / ${total}`;
}

export function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(values.map((value) => value?.trim() ?? "").filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, "vi"));
}

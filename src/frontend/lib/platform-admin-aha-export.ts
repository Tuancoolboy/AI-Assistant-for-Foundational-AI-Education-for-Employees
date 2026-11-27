import type { PlatformAdminAhaReflectionRow } from "@/lib/platform-admin-types";

const VISIBILITY_LABELS: Record<PlatformAdminAhaReflectionRow["visibility"], string> = {
  private: "Riêng tư",
  department: "Phòng ban",
  company: "Công ty",
};

function protectSpreadsheetFormula(value: string): string {
  return /^[=+\-@]/.test(value.trimStart()) ? `'${value}` : value;
}

function csvCell(value: string): string {
  const protectedValue = protectSpreadsheetFormula(value).replaceAll('"', '""');
  return `"${protectedValue}"`;
}

export function buildAhaReflectionsCsv(rows: PlatformAdminAhaReflectionRow[]): string {
  const header = [
    "Thời gian",
    "Người học",
    "Email",
    "Tổ chức",
    "Module",
    "Điều hiểu ra",
    "Hành động tiếp theo",
    "Phạm vi",
  ];
  const body = rows.map((row) => [
    row.createdAt,
    row.userName,
    row.userEmail,
    row.organizationName ?? "",
    row.moduleTitle,
    row.insight,
    row.nextAction ?? "",
    VISIBILITY_LABELS[row.visibility],
  ]);
  return `\uFEFF${[header, ...body].map((line) => line.map(csvCell).join(",")).join("\r\n")}`;
}

export function downloadAhaReflectionsCsv(
  rows: PlatformAdminAhaReflectionRow[],
  date = new Date(),
): void {
  const csv = buildAhaReflectionsCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const datePart = date.toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = `aha-moment-${datePart}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

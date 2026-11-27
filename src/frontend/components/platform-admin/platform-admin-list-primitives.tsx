"use client";

import { ChevronLeft, ChevronRight, Filter, Search, X } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  suspended: "border-amber-200 bg-amber-50 text-amber-800",
  archived: "border-slate-200 bg-slate-100 text-slate-700",
  draft: "border-slate-200 bg-slate-100 text-slate-700",
  published: "border-brand/20 bg-brand-soft text-brand",
  "pending": "border-amber-200 bg-amber-50 text-amber-800",
  activated: "border-emerald-200 bg-emerald-50 text-emerald-700",
  inactive: "border-slate-200 bg-slate-100 text-slate-700",
  company: "border-sky-200 bg-sky-50 text-sky-700",
  individual: "border-violet-200 bg-violet-50 text-violet-700",
  owner: "border-brand/20 bg-brand-soft text-brand",
  manager: "border-sky-200 bg-sky-50 text-sky-700",
  employee: "border-slate-200 bg-slate-100 text-slate-700",
  "super-admin": "border-brand/20 bg-brand-soft text-brand",
};

export function StatusBadge({
  value,
  label,
}: {
  value: string;
  label?: string;
}) {
  const tone = STATUS_STYLES[value] ?? "border-line bg-card text-ink-2";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold capitalize",
        tone,
      )}
    >
      {label ?? value}
    </span>
  );
}

export function ListToolbar({
  children,
  summary,
  className,
}: {
  children: ReactNode;
  summary?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-card px-4 py-4 shadow-sm",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-3">{children}</div>
      {summary ? <div className="mt-3 text-xs text-ink-3">{summary}</div> : null}
    </div>
  );
}

export function ToolbarField({
  icon: Icon,
  label,
  children,
  className,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "flex min-w-[180px] flex-1 items-center gap-2 rounded-xl border border-line bg-secondary/20 px-3 py-2 text-sm transition-all duration-200 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/10",
        className,
      )}
      aria-label={label}
    >
      <Icon className="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
      {children}
    </label>
  );
}

export function ListSearchField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <ToolbarField icon={Search} label={label} className="min-w-[240px]">
      <input
        aria-label={label}
        name="search"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm outline-none placeholder:text-ink-3"
      />
    </ToolbarField>
  );
}

export function ListSelectField({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "inline-flex min-w-[180px] items-center gap-2 rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink transition-all duration-200 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/10",
        className,
      )}
    >
      <Filter className="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        name="filter"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-transparent outline-none cursor-pointer"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ClearFiltersButton({
  onClick,
  children = "Xoá lọc",
}: {
  onClick: () => void;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full border border-line bg-secondary/40 px-3 py-2 text-xs font-semibold text-ink-2 hover:border-brand hover:text-brand"
    >
      <X className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}

export function BulkActionBar({
  count,
  children,
}: {
  count: number;
  children: ReactNode;
}) {
  if (count <= 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/20 bg-brand-soft px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-brand">Đã chọn {count} mục</p>
        <p className="text-xs text-brand/80">Các thao tác sẽ áp dụng cho những dòng đang chọn.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function PaginationBar({
  start,
  end,
  total,
  page,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [8, 16, 32],
}: {
  start: number;
  end: number;
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-card px-4 py-3 text-sm">
      <div className="text-ink-2">
        Hiển thị <span className="font-semibold text-ink">{total === 0 ? 0 : start + 1}-{end}</span> trên{" "}
        <span className="font-semibold text-ink">{total}</span> mục
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-2 rounded-full border border-line bg-secondary/20 px-3 py-2 text-xs font-semibold text-ink-2">
          <span>Số dòng</span>
          <select
            aria-label="Số dòng mỗi trang"
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="bg-transparent text-sm outline-none"
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1 || totalPages <= 1}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-secondary/40 px-3 text-xs font-semibold text-ink-2 hover:border-brand hover:text-brand disabled:opacity-50"
        >
          <ChevronLeft className="h-4 w-4" />
          Trước
        </button>
        <span className="min-w-[84px] text-center text-xs font-semibold uppercase tracking-wide text-ink-3">
          {page} / {Math.max(totalPages, 1)}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages || totalPages <= 1}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-secondary/40 px-3 text-xs font-semibold text-ink-2 hover:border-brand hover:text-brand disabled:opacity-50"
        >
          Sau
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function TableInputField({
  value,
  onChange,
  disabled,
  placeholder,
  ariaLabel,
  name,
  className,
}: {
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  name?: string;
  className?: string;
}) {
  return (
    <input
      type="text"
      aria-label={ariaLabel}
      name={name}
      autoComplete="off"
      spellCheck={false}
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
      className={cn(
        "w-full rounded-lg border border-transparent bg-transparent px-2.5 py-1.5 text-sm text-ink transition-all duration-200 outline-none hover:border-line hover:bg-secondary/20 focus:border-brand focus:bg-card focus:ring-2 focus:ring-brand/10 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    />
  );
}

export function TableSelectField({
  value,
  onChange,
  options,
  disabled,
  ariaLabel,
  name,
  className,
}: {
  value: string | number;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
  ariaLabel?: string;
  name?: string;
  className?: string;
}) {
  return (
    <div className="relative inline-flex w-full items-center">
      <select
        aria-label={ariaLabel}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className={cn(
          "w-full appearance-none rounded-lg border border-transparent bg-transparent px-2.5 py-1.5 pr-8 text-sm text-ink transition-all duration-200 outline-none hover:border-line hover:bg-secondary/20 focus:border-brand focus:bg-card focus:ring-2 focus:ring-brand/10 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer",
          className
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-ink-3 transition-colors" aria-hidden="true">
        ▼
      </span>
    </div>
  );
}


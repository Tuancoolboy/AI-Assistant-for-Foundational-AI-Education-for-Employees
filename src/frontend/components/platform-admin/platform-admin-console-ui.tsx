import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("vi-VN").format(value);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "Chưa có";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function chipClass(active = false) {
  return cn(
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
    active ? "border-brand/20 bg-brand-soft text-brand" : "border-line bg-card text-ink-2",
  );
}

export function PanelCard({
  children,
  className,
  variant = "elevated",
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "glass" | "elevated" | "flat";
}) {
  const styles = {
    elevated: "bg-card border-line shadow-[0_2px_8px_rgba(0,0,0,0.02)]",
    flat: "bg-secondary/10 border-line/50",
    glass: "bg-card/75 backdrop-blur-md border-line/60 shadow-[0_8px_32px_rgba(0,0,0,0.04)]",
  };
  return (
    <div
      className={cn(
        "rounded-2xl border transition-all duration-300",
        styles[variant],
        className
      )}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="font-display text-2xl font-bold tracking-tight text-ink">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm leading-6 text-ink-2">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Sparkline({ data, className }: { data: number[]; className?: string }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min === 0 ? 1 : max - min;
  const width = 120;
  const height = 36;
  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const y = height - 3 - ((val - min) / range) * (height - 6);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg className={cn("overflow-visible", className)} viewBox={`0 0 ${width} ${height}`} width="100%" height={height}>
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export function TrendBadge({
  value,
  direction = "up",
  className,
}: {
  value: string | number;
  direction?: "up" | "down" | "neutral";
  className?: string;
}) {
  const style = {
    up: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    down: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    neutral: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
  };
  const arrow = direction === "up" ? "↑" : direction === "down" ? "↓" : "→";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold",
        style[direction],
        className
      )}
    >
      <span>{arrow}</span>
      <span>{value}</span>
    </span>
  );
}

export function StatusDot({
  status = "success",
  className,
}: {
  status?: "success" | "warning" | "danger" | "info";
  className?: string;
}) {
  const colors = {
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-rose-500",
    info: "bg-blue-500",
  };
  const pulseColors = {
    success: "bg-emerald-400",
    warning: "bg-amber-400",
    danger: "bg-rose-400",
    info: "bg-blue-400",
  };

  return (
    <span className={cn("relative flex h-2.5 w-2.5", className)}>
      <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", pulseColors[status])}></span>
      <span className={cn("relative inline-flex rounded-full h-2.5 w-2.5", colors[status])}></span>
    </span>
  );
}

export function HealthBanner({
  services,
  className,
}: {
  services: { name: string; status: "success" | "warning" | "danger"; details?: string }[];
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-line bg-card/60 p-4 shadow-sm backdrop-blur-sm", className)}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <StatusDot status="success" />
          <span className="text-sm font-semibold text-ink">Toàn bộ hệ thống đang vận hành ổn định</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {services.map((service, idx) => (
            <div key={idx} className="flex items-center gap-1.5 rounded-lg border border-line bg-secondary/30 px-2.5 py-1">
              <span className={cn(
                "h-1.5 w-1.5 rounded-full",
                service.status === "success" ? "bg-emerald-500" : service.status === "warning" ? "bg-amber-500" : "bg-rose-500"
              )} />
              <span className="font-medium text-ink-2">{service.name}</span>
              {service.details && <span className="text-ink-3">({service.details})</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function InsightAlert({
  title,
  message,
  severity = "info",
  onDismiss,
  className,
}: {
  title?: string;
  message: React.ReactNode;
  severity?: "info" | "warning" | "critical" | "success";
  onDismiss?: () => void;
  className?: string;
}) {
  const styles = {
    info: "border-blue-200 bg-blue-50/50 text-blue-800 dark:border-blue-900/30 dark:bg-blue-950/20 dark:text-blue-300",
    warning: "border-amber-200 bg-amber-50/50 text-amber-800 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300",
    critical: "border-rose-200 bg-rose-50/50 text-rose-800 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-300",
    success: "border-emerald-200 bg-emerald-50/50 text-emerald-800 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-300",
  };

  const icons = {
    info: "ℹ️",
    warning: "⚠️",
    critical: "🛑",
    success: "✅",
  };

  return (
    <div className={cn("relative flex gap-3 rounded-2xl border p-4 text-sm shadow-sm transition-all", styles[severity], className)}>
      <span className="text-base shrink-0 leading-none mt-0.5">{icons[severity]}</span>
      <div className="flex-1">
        {title && <h4 className="font-bold leading-tight mb-1">{title}</h4>}
        <div className="leading-relaxed">{message}</div>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs font-semibold opacity-60 hover:opacity-100 transition-opacity ml-2 shrink-0 self-start"
          aria-label="Đóng cảnh báo"
        >
          ✕
        </button>
      )}
    </div>
  );
}

export function MetricCard({
  icon: Icon,
  label,
  value,
  trend,
  trendDirection = "up",
  status = "default",
  sparklineData,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  trend?: string;
  trendDirection?: "up" | "down" | "neutral";
  status?: "default" | "success" | "warning" | "danger" | "info";
  sparklineData?: number[];
}) {
  const iconBgs = {
    default: "bg-brand/10 text-brand border-brand/20",
    success: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    danger: "bg-rose-500/10 text-rose-600 border-rose-500/20",
    info: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  };

  return (
    <div className="rounded-2xl border border-line bg-card p-5 hover:-translate-y-1 transition-all duration-300 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between gap-3">
          <div className={cn("rounded-xl border p-2", iconBgs[status])}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-3">Hệ thống</span>
            {trend && <TrendBadge value={trend} direction={trendDirection} className="mt-1 scale-90 origin-right" />}
          </div>
        </div>
        <p className="mt-4 text-3xl font-extrabold text-ink tracking-tight">
          {new Intl.NumberFormat("vi-VN").format(value)}
        </p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-ink-2">{label}</p>
      </div>
      {sparklineData && sparklineData.length >= 2 && (
        <div className="mt-4 pt-3 border-t border-line/40 text-brand">
          <Sparkline data={sparklineData} className="w-full text-brand/60" />
        </div>
      )}
    </div>
  );
}

export function KpiHeroCard({
  icon: Icon,
  label,
  value,
  trend,
  trendDirection = "up",
  status = "default",
  sparklineData,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  trend?: string;
  trendDirection?: "up" | "down" | "neutral";
  status?: "default" | "success" | "warning" | "danger" | "info";
  sparklineData?: number[];
  className?: string;
}) {
  const iconColors = {
    default: "text-brand bg-brand/10 border-brand/20",
    success: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20",
    warning: "text-amber-600 bg-amber-500/10 border-amber-500/20",
    danger: "text-rose-600 bg-rose-500/10 border-rose-500/20",
    info: "text-blue-600 bg-blue-500/10 border-blue-500/20",
  };

  const borderHoverColors = {
    default: "hover:border-brand/40",
    success: "hover:border-emerald-500/40",
    warning: "hover:border-amber-500/40",
    danger: "hover:border-rose-500/40",
    info: "hover:border-blue-500/40",
  };

  const sparklineColors = {
    default: "text-brand/60",
    success: "text-emerald-500/60",
    warning: "text-amber-500/60",
    danger: "text-rose-500/60",
    info: "text-blue-500/60",
  };

  const isNumeric = typeof value === "number";
  const displayValue = isNumeric ? new Intl.NumberFormat("vi-VN").format(value as number) : value;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-line bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md flex flex-col justify-between h-full min-h-[140px]",
        borderHoverColors[status],
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-2">{label}</p>
          <h3 className="text-3xl font-extrabold text-ink tracking-tight">{displayValue}</h3>
        </div>
        <div className={cn("rounded-2xl border p-3 shadow-inner", iconColors[status])}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
      <div className="mt-4 flex items-end justify-between gap-4">
        {trend ? (
          <TrendBadge value={trend} direction={trendDirection} />
        ) : (
          <span className="text-xs text-ink-3">Không đổi</span>
        )}
        {sparklineData && sparklineData.length >= 2 && (
          <div className="w-24 shrink-0">
            <Sparkline data={sparklineData} className={cn("w-full opacity-80", sparklineColors[status])} />
          </div>
        )}
      </div>
      <div className="absolute -right-6 -bottom-6 h-24 w-24 rounded-full bg-gradient-to-br from-transparent to-brand/5 opacity-40 blur-xl pointer-events-none" />
    </div>
  );
}

export function MetricMini({
  label,
  value,
  suffix,
  trend,
  trendDirection = "up",
  status = "default",
}: {
  label: string;
  value: number | string;
  suffix?: string;
  trend?: string;
  trendDirection?: "up" | "down" | "neutral";
  status?: "default" | "success" | "warning" | "danger" | "info";
}) {
  const bgColors = {
    default: "bg-secondary/20 border-line/60 hover:bg-secondary/35",
    success: "bg-emerald-500/5 border-emerald-500/15 hover:bg-emerald-500/10",
    warning: "bg-amber-500/5 border-amber-500/15 hover:bg-amber-500/10",
    danger: "bg-rose-500/5 border-rose-500/15 hover:bg-rose-500/10",
    info: "bg-blue-500/5 border-blue-500/15 hover:bg-blue-500/10",
  };

  const isNumeric = typeof value === "number";
  const displayValue = isNumeric ? new Intl.NumberFormat("vi-VN").format(value as number) : value;

  return (
    <div
      className={cn(
        "rounded-xl border transition-all duration-300 p-4 flex flex-col justify-between h-full min-h-[96px]",
        bgColors[status]
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-3 leading-tight">{label}</p>
        {trend && (
          <TrendBadge value={trend} direction={trendDirection} className="scale-90 origin-right shrink-0" />
        )}
      </div>
      <p className="mt-2 text-2xl font-bold text-ink leading-none">
        {displayValue}
        {suffix ? <span className="text-sm font-semibold text-ink-2 ml-0.5">{suffix}</span> : null}
      </p>
    </div>
  );
}

export function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-4 py-3 text-left font-bold text-ink-2", className)}>{children}</th>;
}

export function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={cn("px-4 py-3 align-middle text-ink-2 border-t border-line/40", className)}>{children}</td>;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-secondary/15 px-5 py-10 text-center flex flex-col items-center justify-center">
      <div className="rounded-full bg-secondary/30 p-3 mb-3 text-ink-3">
        🔍
      </div>
      <p className="font-bold text-ink text-base">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-ink-2 max-w-md">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ToastBanner({
  kind,
  message,
  onClose,
}: {
  kind: "success" | "error";
  message: string;
  onClose: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed bottom-4 right-4 z-50 max-w-sm rounded-2xl border px-4 py-3.5 text-sm shadow-xl backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-4",
        kind === "success"
          ? "border-emerald-200 bg-emerald-50/95 text-emerald-800"
          : "border-destructive/20 bg-destructive/5 text-destructive",
      )}
    >
      <div className="flex items-start gap-3">
        <p className="min-w-0 flex-1 font-medium">{message}</p>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-bold text-ink-2 hover:text-ink opacity-60 hover:opacity-100 transition-opacity shrink-0"
          aria-label="Đóng thông báo"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

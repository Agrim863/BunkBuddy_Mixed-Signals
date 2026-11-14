import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';

export type BannerTone = 'info' | 'success' | 'warning' | 'danger';

interface StatusBannerProps {
  tone?: BannerTone;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

const toneStyles: Record<BannerTone, { wrapper: string; icon: ReactNode; desc: string }> = {
  info: {
    wrapper: 'border-[var(--primary)]/25 bg-[var(--primary)]/8 text-[var(--text-main)]',
    icon: <Info className="h-4 w-4 shrink-0 text-[var(--primary)]" />,
    desc: 'text-[var(--text-secondary)]',
  },
  success: {
    wrapper: 'border-[var(--status-success)]/25 bg-[var(--status-success-bg)] text-[var(--text-main)]',
    icon: <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--status-success)]" />,
    desc: 'text-[var(--text-secondary)]',
  },
  warning: {
    wrapper: 'border-[var(--status-warning)]/25 bg-[var(--status-warning-bg)] text-[var(--text-main)]',
    icon: <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--status-warning)]" />,
    desc: 'text-[var(--text-secondary)]',
  },
  danger: {
    wrapper: 'border-[var(--status-danger)]/25 bg-[var(--status-danger-bg)] text-[var(--text-main)]',
    icon: <AlertCircle className="h-4 w-4 shrink-0 text-[var(--status-danger)]" />,
    desc: 'text-[var(--text-secondary)]',
  },
};

export function StatusBanner({
  tone = 'info',
  title,
  description,
  action,
  className = '',
}: StatusBannerProps) {
  const style = toneStyles[tone];

  return (
    <div
      className={`flex flex-col justify-between gap-3 rounded-[14px] border px-4 py-3 sm:flex-row sm:items-center ${style.wrapper} ${className}`}
    >
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5">{style.icon}</div>
        <div>
          <p className="text-sm font-semibold">{title}</p>
          {description && (
            <p className={`mt-0.5 text-xs leading-relaxed ${style.desc}`}>{description}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

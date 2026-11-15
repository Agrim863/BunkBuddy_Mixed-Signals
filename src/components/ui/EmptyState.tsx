import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  badge?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  badge,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-[14px] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] px-6 py-12 text-center ${className}`}
    >
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface-well)] text-[var(--primary)] shadow-sm">
        {icon}
      </div>
      {badge && <div className="mb-2.5">{badge}</div>}
      <h3 className="text-base font-semibold text-[var(--text-main)]">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
        {description}
      </p>
      {action && <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">{action}</div>}
    </div>
  );
}

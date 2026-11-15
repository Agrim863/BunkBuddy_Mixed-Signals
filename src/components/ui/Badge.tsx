import type { HTMLAttributes, ReactNode } from 'react';

export type BadgeVariant =
  | 'neutral'
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'danger';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: ReactNode;
  dot?: boolean;
}

const variantClasses: Record<BadgeVariant, string> = {
  neutral: 'bg-[var(--bg-surface-well)] text-[var(--text-secondary)] border-[var(--border-subtle)]',
  primary: 'bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/25 font-semibold',
  secondary: 'bg-[var(--secondary)]/15 text-[var(--text-main)] border-[var(--border-subtle)]',
  success: 'bg-[var(--status-success-bg)] text-[var(--status-success)] border-[var(--status-success)]/25 font-semibold',
  warning: 'bg-[var(--status-warning-bg)] text-[var(--status-warning)] border-[var(--status-warning)]/25 font-semibold',
  danger: 'bg-[var(--status-danger-bg)] text-[var(--status-danger)] border-[var(--status-danger)]/25 font-semibold',
};

const dotClasses: Record<BadgeVariant, string> = {
  neutral: 'bg-[var(--text-secondary)]',
  primary: 'bg-[var(--primary)]',
  secondary: 'bg-[var(--primary)]',
  success: 'bg-[var(--status-success)]',
  warning: 'bg-[var(--status-warning)]',
  danger: 'bg-[var(--status-danger)]',
};

export function Badge({
  variant = 'neutral',
  dot = false,
  children,
  className = '',
  ...props
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap transition-colors duration-200 ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {dot && (
        <span
          className={`h-1.5 w-1.5 rounded-full transition-colors duration-200 ${dotClasses[variant]}`}
        />
      )}
      {children}
    </span>
  );
}

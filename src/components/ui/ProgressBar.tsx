import type { HTMLAttributes } from 'react';

export type ProgressBarSize = 'sm' | 'md' | 'lg';
export type ProgressBarTone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

export interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  size?: ProgressBarSize;
  tone?: ProgressBarTone;
  showValue?: boolean;
  label?: string;
  className?: string;
}

const sizeClasses: Record<ProgressBarSize, string> = {
  sm: 'h-1.5',
  md: 'h-2',
  lg: 'h-3',
};

const toneClasses: Record<ProgressBarTone, string> = {
  primary: 'bg-[var(--primary)]',
  success: 'bg-[var(--status-success)]',
  warning: 'bg-[var(--status-warning)]',
  danger: 'bg-[var(--status-danger)]',
  neutral: 'bg-[var(--text-secondary)]',
};

export function ProgressBar({
  value,
  max = 100,
  size = 'md',
  tone = 'primary',
  showValue = false,
  label,
  className = '',
  ...props
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / (max || 1)) * 100));

  return (
    <div className={`space-y-1.5 ${className}`} {...props}>
      {(label || showValue) && (
        <div className="flex items-center justify-between text-xs">
          {label && <span className="font-medium text-[var(--text-main)]">{label}</span>}
          {showValue && (
            <span className="font-mono tabular-nums text-[var(--text-secondary)]">
              {percentage.toFixed(1)}%
            </span>
          )}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={Math.round(percentage)}
        aria-valuemin={0}
        aria-valuemax={100}
        className={`w-full overflow-hidden rounded-full bg-[var(--bg-surface-well)] border border-[var(--border-subtle)] ${sizeClasses[size]}`}
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out ${toneClasses[tone]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

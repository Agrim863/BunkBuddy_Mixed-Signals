import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--primary)] text-white border border-transparent hover:bg-[var(--primary-hover)] shadow-sm hover:shadow active:scale-[0.98]',
  secondary:
    'bg-[var(--secondary)]/35 text-[var(--text-main)] border border-[var(--border-subtle)] hover:bg-[var(--secondary)]/60 active:scale-[0.98]',
  outline:
    'bg-[var(--bg-surface)] text-[var(--text-main)] border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)] hover:border-[var(--border-strong)] active:scale-[0.98]',
  ghost:
    'bg-transparent text-[var(--text-secondary)] border border-transparent hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-main)] active:scale-[0.98]',
  danger:
    'bg-[var(--status-danger)]/10 text-[var(--status-danger)] border border-[var(--status-danger)]/25 hover:bg-[var(--status-danger)]/20 active:scale-[0.98]',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs rounded-[10px] gap-1.5',
  md: 'h-9 px-3.5 text-sm rounded-[10px] gap-2',
  lg: 'h-10 px-4 text-sm rounded-[10px] gap-2',
};

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  children,
  className = '',
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={`inline-flex items-center justify-center font-medium select-none transition-all duration-150 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/60 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg-app)] ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : leftIcon}
      {children}
      {!isLoading && rightIcon}
    </button>
  );
}

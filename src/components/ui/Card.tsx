import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  size?: 'default' | 'lg';
  interactive?: boolean;
}

const paddingClasses: Record<NonNullable<CardProps['padding']>, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-5 sm:p-6',
  lg: 'p-6 sm:p-7',
};

export function Card({
  children,
  className = '',
  padding = 'md',
  size = 'default',
  interactive = false,
  ...props
}: CardProps) {
  const radiusClass = size === 'lg' ? 'rounded-[18px]' : 'rounded-[14px]';

  return (
    <div
      className={`${radiusClass} border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-main)] shadow-[var(--card-shadow)] transition-all duration-180 ease-out ${
        interactive
          ? 'cursor-pointer hover:-translate-y-[1px] hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)] hover:shadow-[var(--card-shadow-hover)] active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40'
          : ''
      } ${paddingClasses[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className = '',
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex items-start justify-between gap-4 pb-4 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className = '',
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={`text-base font-semibold tracking-[-0.01em] text-[var(--text-main)] ${className}`}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  children,
  className = '',
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={`mt-1 text-xs leading-relaxed text-[var(--text-secondary)] ${className}`} {...props}>
      {children}
    </p>
  );
}

export function CardContent({
  children,
  className = '',
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}

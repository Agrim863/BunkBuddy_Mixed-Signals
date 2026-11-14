import type { InputHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';
import { Tooltip } from './Tooltip';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  tooltip?: string;
  leftAdornment?: ReactNode;
}

export function Input({
  label,
  hint,
  error,
  tooltip,
  leftAdornment,
  id,
  className = '',
  ...props
}: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex items-center gap-1.5">
          <label htmlFor={inputId} className="block text-xs font-medium text-[var(--text-main)]">
            {label}
          </label>
          {tooltip && (
            <Tooltip content={tooltip}>
              <button
                type="button"
                aria-label={`${label} help`}
                className="rounded-full text-[var(--text-secondary)] transition-colors hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50"
              >
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
          )}
        </div>
      )}
      <div className="relative">
        {leftAdornment && (
          <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[var(--text-secondary)]">
            {leftAdornment}
          </div>
        )}
        <input
          id={inputId}
          aria-invalid={Boolean(error) || undefined}
          className={`w-full rounded-[10px] border bg-[var(--bg-surface-well)] px-3 py-2 text-sm text-[var(--text-main)] placeholder:text-[var(--text-secondary)] transition-[border-color,box-shadow,background-color] duration-150 focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${
            leftAdornment ? 'pl-9' : ''
          } ${
            error
              ? 'border-[var(--status-danger)]/70 bg-[var(--status-danger)]/10 focus-visible:border-[var(--status-danger)] focus-visible:ring-[var(--status-danger)]/25'
              : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)] focus-visible:border-[var(--primary)] focus-visible:ring-[var(--primary)]/25'
          } ${className}`}
          {...props}
        />
      </div>
      {error ? (
        <p className="text-xs font-medium text-[var(--status-danger)]">{error}</p>
      ) : hint ? (
        <p className="text-xs text-[var(--text-secondary)]">{hint}</p>
      ) : null}
    </div>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  tooltip?: string;
  children: ReactNode;
}

export function Select({
  label,
  hint,
  error,
  tooltip,
  id,
  children,
  className = '',
  ...props
}: SelectProps) {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex items-center gap-1.5">
          <label htmlFor={selectId} className="block text-xs font-medium text-[var(--text-main)]">
            {label}
          </label>
          {tooltip && (
            <Tooltip content={tooltip}>
              <button
                type="button"
                aria-label={`${label} help`}
                className="rounded-full text-[var(--text-secondary)] transition-colors hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50"
              >
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
          )}
        </div>
      )}
      <select
        id={selectId}
        aria-invalid={Boolean(error) || undefined}
        className={`w-full rounded-[10px] border bg-[var(--bg-surface-well)] px-3 py-2 text-sm text-[var(--text-main)] transition-[border-color,box-shadow,background-color] duration-150 focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${
          error
            ? 'border-[var(--status-danger)]/70 bg-[var(--status-danger)]/10 focus-visible:border-[var(--status-danger)] focus-visible:ring-[var(--status-danger)]/25'
            : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)] focus-visible:border-[var(--primary)] focus-visible:ring-[var(--primary)]/25'
        } ${className}`}
        {...props}
      >
        {children}
      </select>
      {error ? (
        <p className="text-xs font-medium text-[var(--status-danger)]">{error}</p>
      ) : hint ? (
        <p className="text-xs text-[var(--text-secondary)]">{hint}</p>
      ) : null}
    </div>
  );
}

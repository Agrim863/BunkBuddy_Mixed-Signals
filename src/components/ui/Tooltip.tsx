import { useId, type ReactNode } from 'react';

interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom';
  className?: string;
}

export function Tooltip({
  content,
  children,
  position = 'top',
  className = '',
}: TooltipProps) {
  const tooltipId = useId();
  const posClasses =
    position === 'top'
      ? 'bottom-full mb-1.5 left-1/2 -translate-x-1/2'
      : 'top-full mt-1.5 left-1/2 -translate-x-1/2';

  return (
    <span
      className={`group/tip relative inline-flex items-center ${className}`}
      aria-describedby={tooltipId}
    >
      {children}
      <span
        id={tooltipId}
        role="tooltip"
        className={`pointer-events-none absolute z-40 w-max max-w-[220px] rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[11px] font-medium leading-snug text-[var(--text-main)] opacity-0 shadow-md transition-all duration-150 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100 whitespace-normal text-center ${posClasses}`}
      >
        {content}
      </span>
    </span>
  );
}

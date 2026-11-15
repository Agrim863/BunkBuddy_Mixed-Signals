import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description: string;
  badge?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, description, badge, actions }: PageHeaderProps) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-5 border-b border-[var(--border-subtle)] pb-7 sm:flex-row sm:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-[30px] sm:text-[36px] font-normal tracking-tight text-[var(--text-main)]">
            {title}
          </h2>
          {badge}
        </div>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">{description}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}

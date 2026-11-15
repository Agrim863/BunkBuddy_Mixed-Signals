import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';

export function Table({
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto rounded-[14px] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
      <table className={`w-full text-left text-xs text-[var(--text-main)] ${className}`} {...props}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={`border-b border-[var(--border-subtle)] bg-[var(--bg-surface-well)] text-[11px] font-medium text-[var(--text-secondary)] ${className}`}
      {...props}
    >
      {children}
    </thead>
  );
}

export function TableBody({
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={`divide-y divide-[var(--border-subtle)] ${className}`} {...props}>
      {children}
    </tbody>
  );
}

export function TableRow({
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={`transition-colors duration-150 hover:bg-[var(--bg-surface-hover)] ${className}`}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableHead({
  className = '',
  children,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={`px-4 py-2.5 font-semibold text-[var(--text-secondary)] ${className}`} {...props}>
      {children}
    </th>
  );
}

export function TableCell({
  className = '',
  children,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`px-4 py-3 text-[var(--text-main)] ${className}`} {...props}>
      {children}
    </td>
  );
}

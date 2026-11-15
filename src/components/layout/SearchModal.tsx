import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Search } from 'lucide-react';
import { useShell } from '../../context/ShellContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { NAV_ITEMS } from '../../types/navigation';
import type { NavRouteId } from '../../types/domain';
import { NavRouteIcon } from './navIcons';

interface SearchEntry {
  key: string;
  kind: 'subject' | 'route';
  route: NavRouteId;
  title: string;
  subtitle: string;
}

export function SearchModal() {
  const { searchOpen, setSearchOpen, navigate, activeRoute } = useShell();
  const { subjects } = useWorkspace();
  const [query, setQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [rendered, setRendered] = useState(searchOpen);
  const [closing, setClosing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) {
      setRendered(true);
      setClosing(false);
      setQuery('');
      setHighlightIndex(0);
      setTimeout(() => inputRef.current?.focus(), 20);
      return;
    }
    if (!rendered) return;
    setClosing(true);
    const timer = window.setTimeout(() => {
      setRendered(false);
      setClosing(false);
    }, 150);
    return () => window.clearTimeout(timer);
  }, [searchOpen, rendered]);

  useEffect(() => {
    if (!searchOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [searchOpen, setSearchOpen]);

  const entries: SearchEntry[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list: SearchEntry[] = [];

    if (q) {
      for (const sub of subjects) {
        if (
          sub.name.toLowerCase().includes(q) ||
          sub.code.toLowerCase().includes(q)
        ) {
          list.push({
            key: `sub-${sub.id}`,
            kind: 'subject',
            route: 'timetable',
            title: `${sub.name} (${sub.code})`,
            subtitle: 'Subject in active semester — Open Timetable',
          });
        }
      }
    }

    for (const item of NAV_ITEMS) {
      if (
        !q ||
        item.label.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.keywords.some((kw) => kw.includes(q))
      ) {
        list.push({
          key: `route-${item.id}`,
          kind: 'route',
          route: item.id,
          title: item.label,
          subtitle: item.description,
        });
      }
    }

    return list;
  }, [query, subjects]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [query, entries.length]);

  if (!rendered) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-20 backdrop-blur-sm ${
        closing ? 'bw-animate-backdrop-out pointer-events-none' : 'bw-animate-backdrop-in'
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Search navigation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !closing) setSearchOpen(false);
      }}
    >
      <div
        className={`w-full max-w-lg overflow-hidden rounded-[18px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-main)] shadow-xl ${
          closing ? 'bw-animate-modal-out' : 'bw-animate-modal-in'
        }`}
      >
        <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (entries.length === 0) return;
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setHighlightIndex((prev) => (prev + 1) % entries.length);
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHighlightIndex(
                  (prev) => (prev - 1 + entries.length) % entries.length,
                );
              } else if (e.key === 'Enter') {
                e.preventDefault();
                const target = entries[highlightIndex] ?? entries[0];
                if (target) navigate(target.route);
              }
            }}
            placeholder="Jump to view, subject, planner, or settings..."
            className="w-full bg-transparent text-sm text-[var(--text-main)] placeholder:text-[var(--text-secondary)] focus:outline-none"
          />
          <kbd className="rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface-well)] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[var(--text-secondary)]">
            Esc
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {entries.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
              No sections or subjects match &ldquo;{query}&rdquo;.
            </div>
          ) : (
            <div className="space-y-1">
              {entries.map((entry, idx) => {
                const isHighlighted = idx === highlightIndex;
                const isCurrent =
                  entry.kind === 'route' && activeRoute === entry.route;
                return (
                  <button
                    key={entry.key}
                    type="button"
                    onMouseEnter={() => setHighlightIndex(idx)}
                    onClick={() => navigate(entry.route)}
                    className={`flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2.5 text-left transition-all duration-150 active:scale-[0.99] ${
                      isHighlighted ? 'bg-[var(--bg-surface-hover)]' : 'hover:bg-[var(--bg-surface-hover)]/60'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border transition-colors ${
                          isCurrent || isHighlighted
                            ? 'border-[var(--primary)]/40 bg-[var(--primary)]/15 text-[var(--primary)]'
                            : 'border-[var(--border-subtle)] bg-[var(--bg-surface-well)] text-[var(--text-secondary)]'
                        }`}
                      >
                        {entry.kind === 'subject' ? (
                          <BookOpen className="h-4 w-4" />
                        ) : (
                          <NavRouteIcon route={entry.route} className="h-4 w-4" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-main)]">
                          {entry.title}
                        </p>
                        <p className="truncate text-xs text-[var(--text-secondary)]">
                          {entry.subtitle}
                        </p>
                      </div>
                    </div>
                    <ArrowRight
                      className={`h-4 w-4 shrink-0 transition-transform duration-150 ${
                        isHighlighted
                          ? 'translate-x-0.5 text-[var(--primary)]'
                          : 'text-[var(--text-secondary)]'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

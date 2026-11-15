import { useEffect, useState } from 'react';
import { GraduationCap, Menu, X } from 'lucide-react';
import { useShell } from '../../context/ShellContext';
import { NAV_GROUP_LABELS, NAV_ITEMS, type NavItemConfig } from '../../types/navigation';
import type { NavRouteId } from '../../types/domain';
import { NavRouteIcon } from './navIcons';

const GROUPS: NavItemConfig['group'][] = ['core', 'planning', 'schedule', 'system'];

const MOBILE_BAR_ROUTES: NavRouteId[] = [
  'overview',
  'my-attendance',
  'bunk-simulator',
  'academic-calendar',
];

export function MobileNav() {
  const { activeRoute, navigate, mobileNavOpen, setMobileNavOpen, persistenceMode } =
    useShell();

  const [rendered, setRendered] = useState(mobileNavOpen);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (mobileNavOpen) {
      setRendered(true);
      setClosing(false);
      return;
    }
    if (!rendered) return;
    setClosing(true);
    const timer = window.setTimeout(() => {
      setRendered(false);
      setClosing(false);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [mobileNavOpen, rendered]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileNavOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileNavOpen, setMobileNavOpen]);

  return (
    <>
      {/* Mobile Slide-Over Drawer */}
      {rendered && (
        <div
          className="fixed inset-0 z-50 flex lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
        >
          <div
            className={`fixed inset-0 bg-black/60 backdrop-blur-sm ${
              closing ? 'bw-animate-backdrop-out' : 'bw-animate-backdrop-in'
            }`}
            onClick={() => setMobileNavOpen(false)}
          />
          <div
            className={`relative z-10 flex w-72 max-w-[85vw] flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-main)] shadow-2xl ${
              closing ? 'bw-animate-drawer-out' : 'bw-animate-drawer-in'
            }`}
          >
            <div className="flex h-16 items-center justify-between border-b border-[var(--border-subtle)] px-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[var(--primary)] text-white shadow-sm">
                  <GraduationCap className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-bold text-[var(--text-main)]">BunkWise</p>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
                    {persistenceMode === 'local' ? 'Local Mode' : 'Supabase Mode'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close navigation menu"
                className="rounded-[8px] p-1.5 text-[var(--text-secondary)] transition-all duration-150 hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-main)] active:scale-95"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
              {GROUPS.map((group) => {
                const items = NAV_ITEMS.filter((item) => item.group === group);
                return (
                  <div key={group} className="space-y-1">
                    <div className="px-2.5 pb-1 font-mono text-[10px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                      {NAV_GROUP_LABELS[group]}
                    </div>
                    {items.map((item) => {
                      const isActive = activeRoute === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => navigate(item.id)}
                          aria-current={isActive ? 'page' : undefined}
                          className={`relative flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-all duration-150 active:scale-[0.98] ${
                            isActive
                              ? 'bg-[var(--primary)]/10 font-semibold text-[var(--primary)]'
                              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-main)]'
                          }`}
                        >
                          <NavRouteIcon
                            route={item.id}
                            className={`h-4 w-4 ${
                              isActive ? 'text-[var(--primary)]' : 'text-[var(--text-secondary)]'
                            }`}
                          />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Mobile Bottom Quick Bar */}
      <nav
        aria-label="Quick mobile navigation"
        className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 px-2 py-1.5 backdrop-blur-md lg:hidden"
      >
        {MOBILE_BAR_ROUTES.map((routeId) => {
          const item = NAV_ITEMS.find((n) => n.id === routeId)!;
          const isActive = activeRoute === routeId;
          return (
            <button
              key={routeId}
              type="button"
              onClick={() => navigate(routeId)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-[8px] px-2.5 py-1 text-[11px] font-medium transition-all duration-150 active:scale-95 ${
                isActive ? 'font-semibold text-[var(--primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
              }`}
            >
              {isActive && (
                <span className="absolute -top-1.5 h-0.5 w-6 rounded-full bg-[var(--primary)]" />
              )}
              <NavRouteIcon route={routeId} className="h-4 w-4" />
              <span>{item.shortLabel}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          className="flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-[8px] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)] transition-all duration-150 hover:text-[var(--text-main)] active:scale-95"
        >
          <Menu className="h-4 w-4" />
          <span>More</span>
        </button>
      </nav>
    </>
  );
}

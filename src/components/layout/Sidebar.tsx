import { ChevronLeft, ChevronRight, Database, GraduationCap, HardDrive } from 'lucide-react';
import { useShell } from '../../context/ShellContext';
import { NAV_GROUP_LABELS, NAV_ITEMS, type NavItemConfig } from '../../types/navigation';
import { NavRouteIcon } from './navIcons';

const GROUPS: NavItemConfig['group'][] = ['core', 'planning', 'schedule', 'system'];

export function Sidebar() {
  const { activeRoute, navigate, sidebarCollapsed, toggleSidebar, persistenceMode } =
    useShell();

  return (
    <aside
      aria-label="Primary sidebar navigation"
      className={`hidden h-full min-h-0 lg:flex lg:flex-col lg:shrink-0 border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] backdrop-blur-sm transition-[width] duration-200 ease-out ${
        sidebarCollapsed ? 'w-[76px]' : 'w-64'
      }`}
    >
      {/* Brand header */}
      <div
        className={`flex h-16 items-center border-b border-[var(--border-subtle)] ${
          sidebarCollapsed ? 'justify-between px-2' : 'justify-between px-4'
        }`}
      >
        <button
          type="button"
          onClick={() => navigate('overview')}
          className={`flex items-center gap-2.5 rounded-[12px] py-1 text-left transition-all duration-150 hover:bg-[var(--bg-surface-hover)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50 ${sidebarCollapsed ? 'px-0' : 'px-1.5'}`}
          title="BunkWise — Overview"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--primary)] text-white shadow-sm transition-transform duration-150 hover:scale-105">
            <GraduationCap className="h-4 w-4" />
          </span>
          {!sidebarCollapsed && (
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-bold tracking-tight text-[var(--text-main)]">
                BunkWise
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
                Planner
              </span>
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="shrink-0 rounded-[8px] p-1.5 text-[var(--text-secondary)] transition-all duration-150 hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-main)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Navigation items */}
      <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-3 py-4">
        {GROUPS.map((group) => {
          const items = NAV_ITEMS.filter((item) => item.group === group);
          return (
            <div key={group} className="space-y-1">
              {!sidebarCollapsed && (
                <div className="px-2.5 pb-1 font-mono text-[10px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                  {NAV_GROUP_LABELS[group]}
                </div>
              )}
              {items.map((item) => {
                const isActive = activeRoute === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={`group relative flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-sm font-medium transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50 ${
                      sidebarCollapsed ? 'justify-center' : 'justify-start'
                    } ${
                      isActive
                        ? 'bg-[var(--primary)]/10 text-[var(--primary)] font-semibold'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-[var(--primary)] transition-all duration-200 ${
                        isActive ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-50'
                      }`}
                    />
                    <NavRouteIcon
                      route={item.id}
                      className={`h-4 w-4 shrink-0 transition-transform duration-150 group-hover:scale-105 ${
                        isActive
                          ? 'text-[var(--primary)]'
                          : 'text-[var(--text-secondary)] group-hover:text-[var(--text-main)]'
                      }`}
                    />
                    {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Footer mode indicator + expand trigger when collapsed */}
      <div className="shrink-0 space-y-2 border-t border-[var(--border-subtle)] p-3">

        <button
          type="button"
          onClick={() => navigate('settings')}
          title={
            persistenceMode === 'local'
              ? 'Local Mode — stored in browser only'
              : 'Supabase environment configured'
          }
          className={`flex w-full items-center gap-2.5 rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface-well)] px-2.5 py-2 text-left transition-all duration-150 hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50 ${
            sidebarCollapsed ? 'justify-center' : ''
          }`}
        >
          {persistenceMode === 'local' ? (
            <HardDrive className="h-4 w-4 shrink-0 text-[var(--status-warning)]" />
          ) : (
            <Database className="h-4 w-4 shrink-0 text-[var(--status-success)]" />
          )}
          {!sidebarCollapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-[var(--text-main)]">
                {persistenceMode === 'local' ? 'Local Dev Mode' : 'Supabase Ready'}
              </p>
              <p className="truncate text-[11px] text-[var(--text-secondary)]">
                {persistenceMode === 'local' ? 'Browser storage only' : 'Remote PostgreSQL'}
              </p>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}

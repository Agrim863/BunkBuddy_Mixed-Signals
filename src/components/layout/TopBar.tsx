import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  CalendarRange,
  Check,
  ChevronDown,
  HardDrive,
  Menu,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  User,
  X,
} from 'lucide-react';
import { computeSemesterAttendanceReport, formatPercentage } from '../../engine';
import { useShell } from '../../context/ShellContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { NAV_ITEMS } from '../../types/navigation';
import { Badge } from '../ui/Badge';

type OpenPopover = 'semester' | 'notifications' | 'profile' | null;

export function TopBar() {
  const {
    activeRoute,
    navigate,
    setMobileNavOpen,
    setSearchOpen,
    notifications,
    markAllNotificationsRead,
    dismissNotification,
    user,
    persistenceMode,
    resolvedTheme,
    toggleTheme,
  } = useShell();

  const {
    currentUser,
    semesters,
    activeSemester,
    subjects,
    timetableEntries,
    calendarEvents,
    attendanceRecords,
    selectSemester,
    openOnboarding,
  } = useWorkspace();

  const displayUser = currentUser ?? user;

  const attendanceAlerts = useMemo(() => {
    if (!activeSemester) return [];
    const report = computeSemesterAttendanceReport({
      semester: activeSemester,
      subjects,
      timetableEntries,
      calendarEvents,
      attendanceRecords,
    });
    return report.overall.subjectsBelowThreshold.map((item) => ({
      id: `alert-${item.subject.id}`,
      title: `${item.subject.code} below ${Math.round(activeSemester.minimumAttendance * 100)}%`,
      message: `Currently ${formatPercentage(item.percentage)}. Attend ${item.recoveryClassesNeeded ?? '—'} consecutive unit(s) to recover.`,
      targetRoute: 'my-attendance' as const,
      read: false,
    }));
  }, [activeSemester, subjects, timetableEntries, calendarEvents, attendanceRecords]);

  const combinedUnreadCount =
    notifications.filter((n) => !n.read).length + attendanceAlerts.length;

  const [openPopover, setOpenPopover] = useState<OpenPopover>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  const currentNav = NAV_ITEMS.find((item) => item.id === activeRoute) ?? NAV_ITEMS[0]!;

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setOpenPopover(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenPopover(null);
    };
    document.addEventListener('mousedown', onClickOutside);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const togglePopover = (target: Exclude<OpenPopover, null>) => {
    setOpenPopover((prev) => (prev === target ? null : target));
  };

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-20 flex h-16 items-center justify-between gap-2 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/90 px-4 backdrop-blur-md sm:gap-3 sm:px-6 lg:px-8"
    >
      {/* Left: Mobile hamburger + active route indicator + active semester selector */}
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open navigation menu"
          className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface-well)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-main)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="hidden min-w-0 sm:flex sm:flex-col">
          <span className="truncate text-sm font-bold text-[var(--text-main)]">
            {currentNav.label}
          </span>
          <span className="truncate text-[11px] text-[var(--text-secondary)]">
            {currentNav.description}
          </span>
        </div>

        {/* Active Semester Selector Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => togglePopover('semester')}
            aria-label="Select active semester"
            aria-expanded={openPopover === 'semester'}
            className="flex items-center gap-1.5 rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface-well)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-main)] transition-all duration-150 hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50"
          >
            <CalendarRange className="h-3.5 w-3.5 text-[var(--primary)] shrink-0" />
            <span className="max-w-[110px] truncate sm:max-w-[160px]">
              {activeSemester ? activeSemester.name : 'No Semester'}
            </span>
            <ChevronDown className="h-3 w-3 text-[var(--text-secondary)] shrink-0" />
          </button>

          {openPopover === 'semester' && (
            <div className="bw-animate-popover-in absolute left-0 mt-2 w-72 rounded-[18px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5 shadow-lg">
              <div className="px-2 py-1.5">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Active Semesters ({semesters.length})
                </p>
              </div>
              {semesters.length === 0 ? (
                <div className="rounded-[10px] bg-[var(--bg-surface-well)] p-3 text-xs text-[var(--text-secondary)]">
                  No semesters found. Create one with the wizard below.
                </div>
              ) : (
                <div className="space-y-1">
                  {semesters.map((sem) => {
                    const isSelected = activeSemester?.id === sem.id;
                    return (
                      <button
                        key={sem.id}
                        type="button"
                        onClick={() => {
                          selectSemester(sem.id);
                          setOpenPopover(null);
                        }}
                        className={`flex w-full items-center justify-between gap-2 rounded-[10px] px-2.5 py-2 text-left text-xs transition-colors ${
                          isSelected
                            ? 'bg-[var(--primary)]/10 font-semibold text-[var(--primary)]'
                            : 'text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate">{sem.name}</p>
                          <p className="font-mono text-[10px] text-[var(--text-secondary)]">
                            Min {Math.round(sem.minimumAttendance * 100)}% •{' '}
                            {sem.mode === 'fresh' ? 'Fresh' : 'Ongoing'}
                          </p>
                        </div>
                        {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-[var(--primary)]" />}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="mt-2 space-y-1 border-t border-[var(--border-subtle)] pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpenPopover(null);
                    openOnboarding();
                  }}
                  className="flex w-full items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-xs font-semibold text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/10"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add New Semester</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenPopover(null);
                    navigate('settings');
                  }}
                  className="flex w-full items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-main)]"
                >
                  <Settings className="h-3.5 w-3.5" />
                  <span>Manage semester settings</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: Search + Theme Toggle + Notifications + User profile */}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {/* Global Search Trigger */}
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-label="Open global search"
          className="flex items-center gap-2 rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface-well)] p-2 text-xs text-[var(--text-secondary)] transition-all duration-150 hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-main)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50 sm:w-48 sm:justify-between sm:px-2.5 sm:py-1.5"
        >
          <span className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Search...</span>
          </span>
          <kbd className="hidden rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[var(--text-secondary)] sm:inline">
            Ctrl K
          </kbd>
        </button>

        {/* Theme Toggle (Light / Dark) */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={resolvedTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          title={resolvedTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface-well)] text-[var(--text-secondary)] transition-all duration-150 hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--primary)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50"
        >
          {resolvedTheme === 'dark' ? (
            <Sun className="h-4 w-4 transition-transform duration-200 rotate-0 hover:rotate-45" />
          ) : (
            <Moon className="h-4 w-4 transition-transform duration-200 rotate-0 hover:-rotate-12" />
          )}
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            type="button"
            onClick={() => togglePopover('notifications')}
            aria-label="Notifications"
            aria-expanded={openPopover === 'notifications'}
            className="relative flex h-9 w-9 items-center justify-center rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface-well)] text-[var(--text-secondary)] transition-all duration-150 hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-main)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50"
          >
            <Bell className="h-4 w-4" />
            {combinedUnreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[10px] font-bold text-white shadow-sm">
                {combinedUnreadCount}
              </span>
            )}
          </button>

          {openPopover === 'notifications' && (
            <div className="bw-animate-popover-in absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-[18px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 shadow-lg">
              <div className="flex items-center justify-between pb-2">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Notifications
                </span>
                {notifications.some((n) => !n.read) && (
                  <button
                    type="button"
                    onClick={markAllNotificationsRead}
                    className="text-xs font-semibold text-[var(--primary)] hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {notifications.length === 0 && attendanceAlerts.length === 0 ? (
                <div className="rounded-[10px] bg-[var(--bg-surface-well)] px-3 py-6 text-center text-xs text-[var(--text-secondary)]">
                  No notifications right now.
                </div>
              ) : (
                <div className="max-h-72 space-y-2 overflow-y-auto">
                  {attendanceAlerts.map((alert) => (
                    <button
                      key={alert.id}
                      type="button"
                      onClick={() => {
                        navigate(alert.targetRoute);
                        setOpenPopover(null);
                      }}
                      className="w-full rounded-[10px] border border-[var(--status-danger)]/35 bg-[var(--status-danger)]/10 p-2.5 text-left text-xs transition-colors hover:bg-[var(--status-danger)]/20"
                    >
                      <p className="font-semibold text-[var(--status-danger)]">{alert.title}</p>
                      <p className="mt-0.5 leading-relaxed text-[var(--text-secondary)]">
                        {alert.message}
                      </p>
                    </button>
                  ))}
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`rounded-[10px] border p-2.5 text-xs transition-colors ${
                        notif.read
                          ? 'border-[var(--border-subtle)] bg-[var(--bg-surface-well)]'
                          : 'border-[var(--primary)]/35 bg-[var(--primary)]/10'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (notif.targetRoute) {
                              navigate(notif.targetRoute);
                              setOpenPopover(null);
                            }
                          }}
                          className="text-left"
                        >
                          <p className="font-semibold text-[var(--text-main)]">{notif.title}</p>
                          <p className="mt-1 leading-relaxed text-[var(--text-secondary)]">
                            {notif.message}
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() => dismissNotification(notif.id)}
                          aria-label={`Dismiss ${notif.title}`}
                          className="rounded-[6px] p-0.5 text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-main)]"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* User Profile */}
        <div className="relative">
          <button
            type="button"
            onClick={() => togglePopover('profile')}
            aria-label="User profile"
            aria-expanded={openPopover === 'profile'}
            className="flex items-center gap-2 rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface-well)] py-1 pl-1.5 pr-2 text-xs font-semibold text-[var(--text-main)] transition-all duration-150 hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50 sm:pr-2.5"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-[8px] bg-[var(--primary)]/20 text-[var(--primary)]">
              <User className="h-3.5 w-3.5" />
            </span>
            <span className="hidden md:inline">{displayUser.name}</span>
          </button>

          {openPopover === 'profile' && (
            <div className="bw-animate-popover-in absolute right-0 mt-2 w-64 rounded-[18px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 shadow-lg">
              <div className="border-b border-[var(--border-subtle)] pb-3">
                <p className="text-sm font-semibold text-[var(--text-main)]">{displayUser.name}</p>
                <p className="truncate text-xs text-[var(--text-secondary)]">{displayUser.email}</p>
                <div className="mt-2">
                  <Badge variant={persistenceMode === 'local' ? 'warning' : 'success'} dot>
                    {persistenceMode === 'local' ? 'Local Storage Mode' : 'Supabase Mode'}
                  </Badge>
                </div>
              </div>
              <div className="mt-2 space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setOpenPopover(null);
                    navigate('settings');
                  }}
                  className="flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-xs font-medium text-[var(--text-main)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--primary)]"
                >
                  <HardDrive className="h-3.5 w-3.5 text-[var(--primary)]" />
                  <span>Environment &amp; Settings</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

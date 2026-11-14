import { localDateISO } from '../utils/localDate';
import { useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarCheck,
  CalendarOff,
  ChevronDown,
  Clock,
  Compass,
  FlaskConical,
  Plus,
  Rocket,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { useShell } from '../context/ShellContext';
import { useSimulation } from '../context/SimulationContext';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  buildHistoricalTrendPoints,
  computeSemesterAttendanceReport,
  formatPercentage,
  type AttendanceHealthStatus,
} from '../engine';
import { EVENT_TYPE_LABELS } from '../components/calendar/CalendarImportReview';
import { AttendanceTrendCard } from '../components/dashboard/AttendanceTrendCard';
import { getWeekdayShortName } from '../utils/weekdays';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  ProgressBar,
  useToast,
  type BadgeVariant,
} from '../components/ui';

function statusBadgeProps(status: AttendanceHealthStatus): {
  variant: BadgeVariant;
  label: string;
} {
  switch (status) {
    case 'safe':
      return { variant: 'success', label: 'Safe' };
    case 'borderline':
      return { variant: 'warning', label: 'Borderline' };
    case 'danger':
      return { variant: 'danger', label: 'Below Threshold' };
    case 'no_data':
      return { variant: 'neutral', label: 'No Data' };
  }
}

export function OverviewPage() {
  const { navigate, persistenceMode } = useShell();
  const { setFocusSubjectId } = useSimulation();
  const { showToast } = useToast();
  const {
    loading,
    semesters,
    activeSemester,
    subjects,
    timetableEntries,
    calendarEvents,
    attendanceRecords,
    selectSemester,
    openOnboarding,
    loadDemoDataset,
    deleteSemester,
  } = useWorkspace();

  const [expandedSubjectId, setExpandedSubjectId] = useState<string | null>(null);
  const [subjectHealthFilter, setSubjectHealthFilter] = useState<'all' | 'attention' | 'safe'>('all');
  const todayIso = localDateISO();

  const report = useMemo(() => {
    if (!activeSemester) return null;
    return computeSemesterAttendanceReport({
      semester: activeSemester,
      subjects,
      timetableEntries,
      calendarEvents,
      attendanceRecords,
      asOfDate: todayIso,
    });
  }, [
    activeSemester,
    subjects,
    timetableEntries,
    calendarEvents,
    attendanceRecords,
    todayIso,
  ]);

  const trendPoints = useMemo(() => {
    if (!activeSemester) return [];
    return buildHistoricalTrendPoints({
      semester: activeSemester,
      subjects,
      attendanceRecords,
    });
  }, [activeSemester, subjects, attendanceRecords]);

  const subjectById = useMemo(
    () => new Map(subjects.map((s) => [s.id, s])),
    [subjects],
  );

  const upcomingHolidaysAndEvents = useMemo(() => {
    return calendarEvents
      .filter((ev) => (ev.endDate ?? ev.date) >= todayIso)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 4);
  }, [calendarEvents, todayIso]);

  const upcomingClasses = useMemo(() => {
    if (!report) return [];
    return report.upcomingSessions.slice(0, 4);
  }, [report]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="border-b border-[var(--border-subtle)] pb-4">
          <div className="h-8 w-40 rounded-[8px] bg-[var(--bg-surface-well)] animate-pulse" />
          <div className="mt-2 h-4 w-72 rounded-[6px] bg-[var(--bg-surface-well)] animate-pulse" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((n) => (
            <Card key={n} className="h-28 animate-pulse bg-[var(--bg-surface-well)]">
              <div className="h-3 w-24 rounded bg-[var(--border-subtle)]" />
              <div className="mt-4 h-7 w-16 rounded bg-[var(--border-subtle)]" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!activeSemester || !report) {
    return (
      <div className="space-y-6">
        <div className="border-b border-[var(--border-subtle)] pb-4">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)] sm:text-3xl">
            Overview
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Attendance planning, threshold tracking, and bunk simulations.
          </p>
        </div>
        <EmptyState
          icon={<Rocket className="h-5 w-5" />}
          title="Initialize your first semester"
          description="Run the 5-step onboarding wizard for a Fresh or Ongoing semester, or load sample data to explore BunkWise right away."
          action={
            <>
              <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openOnboarding}>
                Start Onboarding Wizard
              </Button>
              <Button
                variant="outline"
                leftIcon={<Sparkles className="h-4 w-4" />}
                onClick={async () => {
                  await loadDemoDataset();
                  showToast({
                    tone: 'info',
                    title: 'Demo dataset loaded',
                    description: '5 sample subjects initialized.',
                  });
                }}
              >
                Load Sample Demo Data
              </Button>
            </>
          }
        />
      </div>
    );
  }

  const thresholdPercent = Math.round(activeSemester.minimumAttendance * 100);
  const overallBadge = statusBadgeProps(report.overall.status);
  const currentPct = report.overall.percentage;
  const diffFromThreshold = currentPct !== null ? currentPct - thresholdPercent : null;

  const filteredSubjectSummaries = report.subjectSummaries.filter((item) => {
    if (subjectHealthFilter === 'attention') {
      return item.status === 'danger' || item.status === 'borderline';
    }
    if (subjectHealthFilter === 'safe') {
      return item.status === 'safe';
    }
    return true;
  });

  const attentionCount =
    report.overall.subjectsBelowThreshold.length + report.overall.subjectsBorderline.length;
  const safeCount = report.subjectSummaries.filter((s) => s.status === 'safe').length;

  return (
    <div className="space-y-6">
      {/* 1. Header with Clean Overview Heading, Semester Context & Compact Selector */}
      <div className="flex flex-col justify-between gap-4 border-b border-[var(--border-subtle)] pb-5 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)] sm:text-3xl">
            Overview
          </h1>
          <p className="mt-1 text-xs text-[var(--text-secondary)] sm:text-sm">
            {activeSemester.name} &bull; {activeSemester.startDate} to {activeSemester.endDate}
          </p>
        </div>

        {/* Compact Semester Selector */}
        {semesters.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-secondary)]">Semester:</span>
            <select
              value={activeSemester.id}
              onChange={(e) => selectSemester(e.target.value)}
              aria-label="Select active semester"
              className="rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 text-xs font-medium text-[var(--text-main)] shadow-sm transition-colors hover:border-[var(--border-strong)] focus:border-[var(--primary)] focus:outline-none"
            >
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.isDemo ? '(Demo)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 8. Demo Notice (Compact Notice replacing oversized demo banner) */}
      {activeSemester.isDemo && (
        <div className="flex flex-col items-start justify-between gap-3 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface-well)] px-4 py-2.5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <Badge variant="secondary">Demo Mode</Badge>
            <span>
              Sample semester data saved in browser {persistenceMode === 'local' ? 'storage' : 'account'}.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={openOnboarding}>
              Start Real Semester
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                await deleteSemester(activeSemester.id);
                showToast({
                  tone: 'info',
                  title: 'Demo semester removed',
                });
              }}
            >
              Remove Demo
            </Button>
          </div>
        </div>
      )}

      {/* 2 & 3. Main Attendance Hero & Bunk Allowance Cards */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* 2. Main Attendance Hero Card */}
        <Card size="lg" className="flex flex-col justify-between lg:col-span-7">
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-[var(--text-secondary)]">
                  Overall Semester Attendance
                </p>
                <div className="mt-1.5 flex items-baseline gap-3">
                  <span className="font-mono text-4xl font-bold tracking-tight tabular-nums text-[var(--text-main)] sm:text-5xl">
                    {formatPercentage(currentPct)}
                  </span>
                  <Badge variant={overallBadge.variant}>{overallBadge.label}</Badge>
                </div>
              </div>

              <div className="text-right">
                <span className="font-mono text-xs font-semibold tabular-nums text-[var(--text-secondary)]">
                  Min {thresholdPercent}%
                </span>
                {diffFromThreshold !== null && (
                  <p
                    className={`mt-1 font-mono text-xs font-bold tabular-nums ${
                      diffFromThreshold >= 0
                        ? 'text-[var(--status-success)]'
                        : 'text-[var(--status-danger)]'
                    }`}
                  >
                    {diffFromThreshold >= 0
                      ? `+${diffFromThreshold.toFixed(1)}% above min`
                      : `${diffFromThreshold.toFixed(1)}% below min`}
                  </p>
                )}
              </div>
            </div>

            {/* Attendance Progress Bar */}
            <div className="mt-5 space-y-1.5">
              <ProgressBar
                value={currentPct ?? 0}
                tone={
                  report.overall.status === 'danger'
                    ? 'danger'
                    : report.overall.status === 'borderline'
                      ? 'warning'
                      : 'success'
                }
                size="md"
              />
              <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                <span>0%</span>
                <span className="font-medium text-[var(--text-main)]">
                  Threshold: {thresholdPercent}%
                </span>
                <span>100%</span>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-3 text-xs text-[var(--text-secondary)]">
            <span>
              {report.overall.conducted === 0
                ? 'No classes conducted yet'
                : report.overall.recoveryClassesNeeded && report.overall.recoveryClassesNeeded > 0
                  ? `Recovery: Attend ${report.overall.recoveryClassesNeeded} consecutive unit(s) to restore ${thresholdPercent}%`
                  : `Safe margin: You can skip ${report.overall.immediateSafeBunks} consecutive unit(s) overall`}
            </span>
            <span className="font-mono tabular-nums text-[var(--text-main)]">
              {report.overall.attended} attended / {report.overall.conducted} conducted
            </span>
          </div>
        </Card>

        {/* 3. Bunk Allowance Card */}
        <Card size="lg" className="flex flex-col justify-between lg:col-span-5">
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-[var(--text-secondary)]">
                Immediate Bunk Allowance
              </p>
              <Compass className="h-4 w-4 text-[var(--primary)]" />
            </div>

            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-4xl font-bold tracking-tight tabular-nums text-[var(--text-main)] sm:text-5xl">
                {report.overall.immediateSafeBunks}
              </span>
              <span className="text-sm font-medium text-[var(--text-secondary)]">
                unit{report.overall.immediateSafeBunks === 1 ? '' : 's'}
              </span>
            </div>

            <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
              {report.overall.immediateSafeBunks > 0
                ? `Calculated immediate consecutive bunk allowance across total conducted units while maintaining your ${thresholdPercent}% threshold.`
                : report.overall.recoveryClassesNeeded && report.overall.recoveryClassesNeeded > 0
                  ? `Currently below threshold. Attend ${report.overall.recoveryClassesNeeded} consecutive unit(s) to restore your safe margin.`
                  : 'Attendance is right at your threshold margin. Any immediate bunk will drop you below requirement.'}
            </p>

            {/* Crucial Disclaimer: Subject Eligibility Rule */}
            <div className="mt-4 flex items-start gap-2 rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface-well)] p-2.5 text-[11px] text-[var(--text-secondary)]">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--status-warning)]" />
              <span>
                <strong>Subject Rule:</strong> Overall buffer does not imply every subject can be skipped. Check individual subject thresholds below.
              </span>
            </div>
          </div>

          <div className="mt-5 border-t border-[var(--border-subtle)] pt-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              leftIcon={<FlaskConical className="h-3.5 w-3.5 text-[var(--primary)]" />}
              onClick={() => navigate('bunk-simulator')}
            >
              Test Scenarios in Simulator
            </Button>
          </div>
        </Card>
      </div>

      {/* 4. Supporting Metrics (Compact Cards) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card padding="sm">
          <p className="text-[11px] font-medium text-[var(--text-secondary)]">Units Attended</p>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums text-[var(--text-main)]">
            {report.overall.attended}
          </p>
          <p className="mt-0.5 text-[10px] text-[var(--text-secondary)]">
            Across {subjects.length} subject{subjects.length === 1 ? '' : 's'}
          </p>
        </Card>

        <Card padding="sm">
          <p className="text-[11px] font-medium text-[var(--text-secondary)]">Units Conducted</p>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums text-[var(--text-main)]">
            {report.overall.conducted}
          </p>
          <p className="mt-0.5 text-[10px] text-[var(--text-secondary)]">
            Sessions held to date
          </p>
        </Card>

        <Card padding="sm">
          <p className="text-[11px] font-medium text-[var(--text-secondary)]">Units Missed</p>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums text-[var(--text-main)]">
            {report.overall.missed}
          </p>
          <p className="mt-0.5 text-[10px] text-[var(--text-secondary)]">
            Absences &amp; bunks
          </p>
        </Card>

        <Card padding="sm">
          <p className="text-[11px] font-medium text-[var(--text-secondary)]">Remaining Scheduled</p>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums text-[var(--text-main)]">
            {report.overall.remainingScheduledUnits}
          </p>
          <p className="mt-0.5 text-[10px] text-[var(--text-secondary)]">
            Units to semester end
          </p>
        </Card>
      </div>

      {/* 6. Quick Actions (Two Prominent Interactive Action Tiles) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div
          role="button"
          tabIndex={0}
          onClick={() => navigate('bunk-simulator')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              navigate('bunk-simulator');
            }
          }}
          className="group flex cursor-pointer items-center justify-between rounded-[14px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-sm transition-all duration-180 hover:-translate-y-[1px] hover:border-[var(--border-strong)] hover:shadow-[var(--card-shadow-hover)] active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50"
        >
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[var(--primary)]/12 text-[var(--primary)] transition-transform duration-180 group-hover:scale-105">
              <FlaskConical className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--text-main)]">Bunk Simulator</p>
              <p className="text-xs text-[var(--text-secondary)]">
                Model skipping lectures &amp; forecast threshold impact
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-[var(--text-secondary)] transition-transform duration-180 group-hover:translate-x-1 group-hover:text-[var(--primary)]" />
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => navigate('my-attendance')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              navigate('my-attendance');
            }
          }}
          className="group flex cursor-pointer items-center justify-between rounded-[14px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-sm transition-all duration-180 hover:-translate-y-[1px] hover:border-[var(--border-strong)] hover:shadow-[var(--card-shadow-hover)] active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50"
        >
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[var(--status-success)]/12 text-[var(--status-success)] transition-transform duration-180 group-hover:scale-105">
              <CalendarCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--text-main)]">Update Attendance</p>
              <p className="text-xs text-[var(--text-secondary)]">
                Log sessions as present, absent, or mass bunk
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-[var(--text-secondary)] transition-transform duration-180 group-hover:translate-x-1 group-hover:text-[var(--primary)]" />
        </div>
      </div>

      {/* 5 & 7. Subject Health (Compact Section) & Attendance Trend */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* 5. Subject Health Compact Section */}
        <Card className="lg:col-span-7">
          <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Subject Health</CardTitle>
              <CardDescription>
                Individual attendance vs. {thresholdPercent}% requirement
              </CardDescription>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface-well)] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setSubjectHealthFilter('all')}
                className={`rounded-[8px] px-2.5 py-1 font-medium transition-colors ${
                  subjectHealthFilter === 'all'
                    ? 'bg-[var(--bg-surface)] font-semibold text-[var(--text-main)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                }`}
              >
                All ({report.subjectSummaries.length})
              </button>
              <button
                type="button"
                onClick={() => setSubjectHealthFilter('attention')}
                className={`flex items-center gap-1 rounded-[8px] px-2.5 py-1 font-medium transition-colors ${
                  subjectHealthFilter === 'attention'
                    ? 'bg-[var(--bg-surface)] font-semibold text-[var(--status-danger)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                }`}
              >
                <span>Attention</span>
                {attentionCount > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--status-danger)]/15 px-1 text-[10px] font-bold text-[var(--status-danger)]">
                    {attentionCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setSubjectHealthFilter('safe')}
                className={`rounded-[8px] px-2.5 py-1 font-medium transition-colors ${
                  subjectHealthFilter === 'safe'
                    ? 'bg-[var(--bg-surface)] font-semibold text-[var(--status-success)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                }`}
              >
                Safe ({safeCount})
              </button>
            </div>
          </CardHeader>

          <CardContent className="space-y-2.5">
            {filteredSubjectSummaries.length === 0 ? (
              <div className="rounded-[10px] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-well)] px-4 py-8 text-center text-xs text-[var(--text-secondary)]">
                {subjectHealthFilter === 'attention'
                  ? 'All subjects are currently safe above your threshold!'
                  : 'No subjects match this filter.'}
              </div>
            ) : (
              filteredSubjectSummaries.map((item) => {
                const badge = statusBadgeProps(item.status);
                const isExpanded = expandedSubjectId === item.subject.id;
                const pct = item.percentage ?? 0;

                return (
                  <div
                    key={item.subject.id}
                    className={`rounded-[12px] border transition-all duration-150 ${
                      isExpanded
                        ? 'border-[var(--primary)]/40 bg-[var(--bg-surface-well)]'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)]'
                    }`}
                  >
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() =>
                        setExpandedSubjectId(isExpanded ? null : item.subject.id)
                      }
                      className="w-full p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: item.subject.color }}
                          />
                          <span className="truncate font-semibold text-xs text-[var(--text-main)]">
                            {item.subject.name}
                          </span>
                          <span className="font-mono text-[11px] text-[var(--text-secondary)]">
                            ({item.subject.code})
                          </span>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <span className="font-mono text-xs font-bold tabular-nums text-[var(--text-main)]">
                            {formatPercentage(item.percentage)}
                          </span>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                          <ChevronDown
                            className={`h-3.5 w-3.5 text-[var(--text-secondary)] transition-transform duration-200 ${
                              isExpanded ? 'rotate-180 text-[var(--primary)]' : ''
                            }`}
                          />
                        </div>
                      </div>

                      {/* Compact Progress Bar */}
                      <div className="mt-2.5">
                        <ProgressBar
                          value={pct}
                          tone={
                            item.status === 'danger'
                              ? 'danger'
                              : item.status === 'borderline'
                                ? 'warning'
                                : 'success'
                          }
                          size="sm"
                        />
                      </div>

                      {/* Concise Status / Recovery Guidance */}
                      <div className="mt-2 flex items-center justify-between text-[11px]">
                        <span
                          className={
                            item.status === 'danger'
                              ? 'font-medium text-[var(--status-danger)]'
                              : item.status === 'borderline'
                                ? 'font-medium text-[var(--status-warning)]'
                                : 'text-[var(--text-secondary)]'
                          }
                        >
                          {item.status === 'danger' && item.recoveryClassesNeeded
                            ? `Below threshold • Attend ${item.recoveryClassesNeeded} consecutive unit(s) to recover`
                            : item.status === 'borderline'
                              ? `Borderline • ${item.immediateSafeBunks} safe skip remaining`
                              : item.status === 'no_data'
                                ? 'Awaiting first conducted class'
                                : `${item.immediateSafeBunks} safe skip(s) • Semester budget: ${item.semesterAbsenceBudget} units`}
                        </span>
                        <span className="font-mono tabular-nums text-[var(--text-secondary)]">
                          {item.attended}/{item.conducted} units
                        </span>
                      </div>
                    </button>

                    {/* Expandable Detailed Context */}
                    <div className="bw-accordion" data-open={isExpanded ? 'true' : 'false'}>
                      <div>
                        <div className="border-t border-[var(--border-subtle)] px-3 pb-3 pt-2 text-[11px] text-[var(--text-secondary)]">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap gap-3 font-mono tabular-nums">
                              <span>
                                Baseline: {item.historicalAttended}/{item.historicalConducted}
                              </span>
                              <span>
                                Tracked: {item.trackedAttended}/{item.trackedConducted}
                              </span>
                              <span>
                                Max Projected:{' '}
                                <strong className="text-[var(--text-main)]">
                                  {formatPercentage(item.projectedIfAttendAllPercentage)}
                                </strong>
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setFocusSubjectId(item.subject.id);
                                  navigate('bunk-simulator');
                                }}
                              >
                                Simulate
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => navigate('my-attendance')}
                              >
                                View Log
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* 7. Attendance Trend Chart */}
        <div className="lg:col-span-5">
          <AttendanceTrendCard
            points={trendPoints}
            thresholdPercent={thresholdPercent}
          />
        </div>
      </div>

      {/* 9. Upcoming Schedule & Academic Calendar */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Upcoming Classes */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Upcoming Scheduled Classes</CardTitle>
              <CardDescription>
                Predictions exclude holidays; attendance units update upon confirmation
              </CardDescription>
            </div>
            <Clock className="h-4 w-4 text-[var(--primary)]" />
          </CardHeader>
          <CardContent>
            {upcomingClasses.length === 0 ? (
              <div className="rounded-[10px] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-well)] px-4 py-6 text-center text-xs text-[var(--text-secondary)]">
                No upcoming classes remaining in your timetable.
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingClasses.map((slot) => {
                  const sub = subjectById.get(slot.subjectId);
                  return (
                    <button
                      key={`${slot.date}-${slot.timetableEntryId}`}
                      type="button"
                      onClick={() => navigate('my-attendance')}
                      className="flex w-full items-center justify-between gap-3 rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface-well)] px-3.5 py-2 text-left text-xs transition-all duration-150 hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: sub?.color ?? 'var(--primary)' }}
                        />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[var(--text-main)]">
                            {sub ? `${sub.name} (${sub.code})` : 'Subject'}
                          </p>
                          <p className="font-mono text-[11px] tabular-nums text-[var(--text-secondary)]">
                            {getWeekdayShortName(slot.weekday)} &bull; {slot.date} &bull; {slot.startTime}–{slot.endTime}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Badge variant="neutral" className="capitalize">
                          {slot.sessionType}
                        </Badge>
                        <Badge variant="primary">
                          {slot.attendanceUnits}u
                        </Badge>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Holidays & Events */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Academic Calendar &amp; Holidays</CardTitle>
              <CardDescription>
                Non-teaching periods and holidays excluded from predictions
              </CardDescription>
            </div>
            <CalendarOff className="h-4 w-4 text-[var(--primary)]" />
          </CardHeader>
          <CardContent>
            {upcomingHolidaysAndEvents.length === 0 ? (
              <div className="rounded-[10px] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-well)] px-4 py-6 text-center text-xs text-[var(--text-secondary)]">
                No upcoming holidays or academic events scheduled from {todayIso}.
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingHolidaysAndEvents.map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => navigate('academic-calendar')}
                    className="flex w-full items-start justify-between gap-3 rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface-well)] px-3.5 py-2 text-left text-xs transition-all duration-150 hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--text-main)]">{ev.title}</p>
                      <p className="font-mono text-[11px] tabular-nums text-[var(--text-secondary)]">
                        {ev.date}
                        {ev.endDate ? ` → ${ev.endDate}` : ''}
                      </p>
                    </div>
                    <Badge variant={ev.affectsClasses ? 'warning' : 'neutral'}>
                      {EVENT_TYPE_LABELS[ev.eventType]}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

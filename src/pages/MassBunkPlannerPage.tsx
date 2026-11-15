import { localDateISO } from '../utils/localDate';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CalendarX2,
  CheckSquare,
  ChevronDown,
  Info,
  Rocket,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useSimulation } from '../context/SimulationContext';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  computeSemesterAttendanceReport,
  formatPercentage,
  formatPercentagePointDelta,
  simulateMassBunkDate,
  type AttendanceHealthStatus,
} from '../engine';
import { getWeekdayName } from '../utils/weekdays';
import { PageHeader } from '../components/layout/PageHeader';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  ProgressBar,
  StatusBanner,
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

export function MassBunkPlannerPage() {
  const {
    activeSemester,
    subjects,
    timetableEntries,
    calendarEvents,
    attendanceRecords,
    openOnboarding,
  } = useWorkspace();

  const {
    massBunkDate,
    setMassBunkDate,
    massBunkEntryIds,
    setMassBunkEntryIds,
    toggleMassBunkEntryId,
  } = useSimulation();

  // State to track expanded subject rows
  const [expandedSubjectIds, setExpandedSubjectIds] = useState<string[]>([]);

  const toggleSubjectExpand = (id: string) => {
    setExpandedSubjectIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const expandAllSubjects = (ids: string[]) => {
    setExpandedSubjectIds(ids);
  };

  const collapseAllSubjects = () => {
    setExpandedSubjectIds([]);
  };

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

  const simulation = useMemo(() => {
    if (!report) return null;
    return simulateMassBunkDate({
      report,
      dateIso: massBunkDate,
      timetableEntries,
      calendarEvents,
      attendanceRecords,
      selectedTimetableEntryIds: massBunkEntryIds,
    });
  }, [
    report,
    massBunkDate,
    timetableEntries,
    calendarEvents,
    attendanceRecords,
    massBunkEntryIds,
  ]);

  // Pre-select all scheduled lectures on date change if nothing is selected for that day yet
  const daySlotIdsKey = simulation
    ? simulation.scheduledLectures.filter((l) => !l.alreadyRecorded && !simulation.blockingCalendarEvent).map((l) => l.timetableEntry.id).join(',')
    : '';

  useEffect(() => {
    if (!simulation) return;
    setMassBunkEntryIds(
      simulation.scheduledLectures.filter((l) => !l.alreadyRecorded && !simulation.blockingCalendarEvent).map((l) => l.timetableEntry.id),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [massBunkDate, daySlotIdsKey]);

  const quickTeachingDays = useMemo(() => {
    if (!report) return [];
    const dates: string[] = [];
    for (const session of report.upcomingSessions) {
      if (!dates.includes(session.date)) dates.push(session.date);
      if (dates.length >= 6) break;
    }
    return dates;
  }, [report]);

  if (!activeSemester || !report || !simulation) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Mass Bunk Tracker"
          description="Select a date, inspect scheduled lectures, and evaluate subject-wise and consolidated impact."
        />
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title="No active semester configured"
          description="Run the semester onboarding wizard or load the 5-subject demo dataset to plan mass bunks."
          action={
            <Button leftIcon={<Rocket className="h-4 w-4" />} onClick={openOnboarding}>
              Start Semester Onboarding
            </Button>
          }
        />
      </div>
    );
  }

  const thresholdPercent = Math.round(activeSemester.minimumAttendance * 100);
  const consolidated = simulation.consolidatedImpact;
  const afterBadge = statusBadgeProps(consolidated.statusAfter);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mass Bunk Tracker"
        description={`${activeSemester.name} • Evaluate coordinated absence across all lectures scheduled on a single date.`}
        badge={
          <Badge variant="primary" dot>
            <ShieldCheck className="h-3 w-3" />
            Simulation Sandbox
          </Badge>
        }
      />

      <StatusBanner
        tone="warning"
        title="Business Rule: Mass Bunks Count as Conducted Absences"
        description="A mass bunk is never automatically classified as an academic holiday. Selected classes increment conducted units without incrementing attended units."
      />

      {simulation.blockingCalendarEvent && (
        <StatusBanner
          tone="info"
          title={`Note: ${massBunkDate} is marked "${simulation.blockingCalendarEvent.title}"`}
          description="This date is marked non-teaching. Classes are excluded from the simulation. To simulate a conducted class, update the academic calendar first."
        />
      )}

      {/* Two-Column Responsive Layout */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* LEFT COLUMN: PLANNING CONTROLS */}
        <div className="space-y-5 xl:col-span-5">
          <Card>
            <CardHeader className="pb-3.5">
              <div className="flex items-center gap-2">
                <CalendarX2 className="h-4 w-4 text-[var(--primary)]" />
                <CardTitle>1. Date &amp; Affected Lectures</CardTitle>
              </div>
              <CardDescription>
                {getWeekdayName(simulation.weekday)} ({massBunkDate})
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Date Input & Quick Pick Chips */}
              <div className="space-y-2 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface-well)] p-3.5">
                <Input
                  label="Common Mass Bunk Date"
                  type="date"
                  min={activeSemester.startDate}
                  max={activeSemester.endDate}
                  value={massBunkDate}
                  onChange={(e) => setMassBunkDate(e.target.value)}
                />

                {quickTeachingDays.length > 0 && (
                  <div className="pt-1">
                    <p className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                      Upcoming Teaching Days
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {quickTeachingDays.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setMassBunkDate(d)}
                          className={`rounded-[6px] border px-2 py-1 font-mono text-[11px] font-semibold tabular-nums transition-all duration-150 active:scale-95 ${
                            massBunkDate === d
                              ? 'border-[var(--primary)] bg-[var(--primary)]/15 text-[var(--primary)]'
                              : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-main)]'
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Scheduled Lectures Header & Action Bar */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-[var(--primary)]" />
                    <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                      Scheduled Lectures ({simulation.scheduledLectures.length})
                    </span>
                  </div>
                  {simulation.scheduledLectures.length > 0 && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setMassBunkEntryIds(
                            simulation.scheduledLectures.filter((l) => !l.alreadyRecorded && !simulation.blockingCalendarEvent).map((l) => l.timetableEntry.id),
                          )
                        }
                        className="rounded-[6px] px-2 py-0.5 text-xs font-semibold text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/10"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={() => setMassBunkEntryIds([])}
                        className="rounded-[6px] px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-main)]"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                {simulation.scheduledLectures.length === 0 ? (
                  <div className="space-y-2.5 rounded-[10px] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-well)] px-4 py-7 text-center text-xs text-[var(--text-secondary)]">
                    <p>
                      No classes scheduled on {getWeekdayName(simulation.weekday)}. Pick another date to simulate mass bunk impact.
                    </p>
                    {quickTeachingDays[0] && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setMassBunkDate(quickTeachingDays[0]!)}
                      >
                        Jump to {quickTeachingDays[0]}
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {simulation.scheduledLectures.map((lecture) => {
                      const id = lecture.timetableEntry.id;
                      const unavailable = Boolean(lecture.alreadyRecorded || simulation.blockingCalendarEvent);
                      const checked = !unavailable && massBunkEntryIds.includes(id);
                      return (
                        <label
                          key={id}
                          className={`flex ${unavailable ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} items-center justify-between gap-3 rounded-[10px] border p-3 text-xs transition-all duration-150 active:scale-[0.99] ${
                            checked
                              ? 'border-[var(--primary)] bg-[var(--primary)]/10 font-semibold'
                              : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)]'
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={unavailable}
                              onChange={() => toggleMassBunkEntryId(id)}
                              className="h-4 w-4 rounded border-[var(--border-subtle)] accent-[var(--primary)]"
                            />
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: lecture.subject.color }}
                            />
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-[var(--text-main)]">
                                {lecture.subject.name} ({lecture.subject.code})
                              </p>
                              <p className="font-mono tabular-nums text-[11px] text-[var(--text-secondary)]">
                                {lecture.timetableEntry.startTime}–{lecture.timetableEntry.endTime} •{' '}
                                {lecture.timetableEntry.sessionType}
                              </p>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-1.5">
                            {lecture.alreadyRecorded && (
                              <Badge variant="neutral" className="capitalize">
                                Logged: {lecture.alreadyRecorded.status.replace('_', ' ')}
                              </Badge>
                            )}
                            <Badge variant="neutral">
                              {lecture.timetableEntry.attendanceUnits}u
                            </Badge>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: IMPACT PREVIEW */}
        <div className="space-y-6 xl:col-span-7">
          {/* Consolidated Impact Card */}
          <Card>
            <CardHeader className="pb-3.5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--primary)]">
                    Consolidated Impact Preview
                  </span>
                </div>
                <CardTitle className="mt-0.5">2. Aggregate Semester Effect</CardTitle>
                <CardDescription>
                  Combined effect across {consolidated.affectedSubjectsCount} affected subject
                  {consolidated.affectedSubjectsCount === 1 ? '' : 's'} on {massBunkDate}
                </CardDescription>
              </div>
              <Badge variant={afterBadge.variant} dot>
                {afterBadge.label}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Visual Before vs After Strip */}
              <div className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface-well)] p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                        Overall Before
                      </span>
                      <p className="font-mono text-base font-bold tabular-nums text-[var(--text-main)]">
                        {formatPercentage(consolidated.beforePercentage)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-[var(--text-secondary)]">→</span>
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--primary)]">
                        Overall After
                      </span>
                      <p className="font-mono text-base font-bold tabular-nums text-[var(--text-main)]">
                        {formatPercentage(consolidated.afterPercentage)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 font-mono text-xs font-bold tabular-nums ${
                        (consolidated.percentagePointDelta ?? 0) < 0
                          ? 'text-[var(--status-danger)]'
                          : 'text-[var(--status-success)]'
                      }`}
                    >
                      {(consolidated.percentagePointDelta ?? 0) < 0 ? (
                        <TrendingDown className="h-3.5 w-3.5" />
                      ) : (
                        <TrendingUp className="h-3.5 w-3.5" />
                      )}
                      {formatPercentagePointDelta(consolidated.percentagePointDelta)}
                    </span>
                    <Badge variant={afterBadge.variant}>{afterBadge.label}</Badge>
                  </div>
                </div>

                <div className="mt-2.5">
                  <ProgressBar
                    value={consolidated.afterPercentage ?? 0}
                    tone={
                      consolidated.statusAfter === 'danger'
                        ? 'danger'
                        : consolidated.statusAfter === 'borderline'
                          ? 'warning'
                          : 'success'
                    }
                    size="sm"
                  />
                </div>
              </div>

              {/* 4-Metric Comparison Grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                    Units Missed
                  </p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-[var(--text-main)]">
                    +{consolidated.totalMissedUnits}u
                  </p>
                  <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                    Selected for mass bunk
                  </p>
                </div>

                <div className="rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                    Overall Before
                  </p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-[var(--text-main)]">
                    {formatPercentage(consolidated.beforePercentage)}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] tabular-nums text-[var(--text-secondary)]">
                    {consolidated.beforeAttended}/{consolidated.beforeConducted} units
                  </p>
                </div>

                <div className="rounded-[10px] border border-[var(--primary)]/45 bg-[var(--primary)]/10 p-3">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--primary)]">
                    Overall After
                  </p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-[var(--text-main)]">
                    {formatPercentage(consolidated.afterPercentage)}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] tabular-nums text-[var(--text-secondary)]">
                    {consolidated.afterAttended}/{consolidated.afterConducted} units
                  </p>
                </div>

                <div className="rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                    Net Change
                  </p>
                  <p
                    className={`mt-1 text-xl font-bold tabular-nums ${
                      (consolidated.percentagePointDelta ?? 0) < 0
                        ? 'text-[var(--status-danger)]'
                        : 'text-[var(--text-main)]'
                    }`}
                  >
                    {formatPercentagePointDelta(consolidated.percentagePointDelta)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                    Percentage point delta
                  </p>
                </div>
              </div>

              {/* Newly Below Threshold Warning */}
              {consolidated.newlyBelowThresholdCount > 0 && (
                <div className="flex items-center gap-2 rounded-[10px] border border-[var(--status-danger)]/35 bg-[var(--status-danger)]/10 px-3.5 py-2.5 text-xs font-medium text-[var(--status-danger)]">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--status-danger)]" />
                  <span>
                    Warning: {consolidated.newlyBelowThresholdCount} subject
                    {consolidated.newlyBelowThresholdCount === 1 ? '' : 's'} will fall below{' '}
                    {thresholdPercent}% minimum requirement if this mass bunk is executed.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Subject-Wise Impact (Compact Expandable Rows) */}
          <Card>
            <CardHeader className="pb-3.5">
              <div>
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-[var(--primary)]" />
                  <CardTitle>3. Subject-Wise Impact</CardTitle>
                </div>
                <CardDescription>
                  Detailed attendance drops, threshold safety, and recovery requirements per affected subject
                </CardDescription>
              </div>
              {simulation.subjectImpacts.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      expandAllSubjects(simulation.subjectImpacts.map((i) => i.subject.id))
                    }
                    className="text-xs font-semibold text-[var(--primary)] hover:underline"
                  >
                    Expand All
                  </button>
                  <span className="text-[var(--border-strong)]">•</span>
                  <button
                    type="button"
                    onClick={collapseAllSubjects}
                    className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-main)]"
                  >
                    Collapse
                  </button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {simulation.subjectImpacts.length === 0 ? (
                <div className="rounded-[10px] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-well)] px-4 py-8 text-center text-xs text-[var(--text-secondary)]">
                  Select one or more scheduled lectures on the left to compute subject-wise impact.
                </div>
              ) : (
                <div className="space-y-2">
                  {simulation.subjectImpacts.map((impact) => {
                    const isExpanded = expandedSubjectIds.includes(impact.subject.id);
                    const afterStatus = statusBadgeProps(impact.statusAfter);

                    return (
                      <div
                        key={impact.subject.id}
                        className={`rounded-[12px] border transition-all duration-150 ${
                          isExpanded
                            ? 'border-[var(--primary)]/40 bg-[var(--bg-surface-well)]'
                            : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)]'
                        }`}
                      >
                        {/* Summary Header Bar (Clickable) */}
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          onClick={() => toggleSubjectExpand(impact.subject.id)}
                          className="w-full p-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            {/* Subject Identity */}
                            <div className="flex min-w-0 items-center gap-2.5">
                              <span
                                className="h-3 w-3 shrink-0 rounded-full"
                                style={{ backgroundColor: impact.subject.color }}
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="truncate font-semibold text-[var(--text-main)]">
                                    {impact.subject.name}
                                  </span>
                                  <span className="font-mono text-xs text-[var(--text-secondary)]">
                                    ({impact.subject.code})
                                  </span>
                                </div>
                                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                                  <span className="font-mono font-semibold text-[var(--primary)]">
                                    +{impact.missedUnits}u missed
                                  </span>
                                  <span>•</span>
                                  <span>
                                    {impact.statusAfter === 'danger'
                                      ? `Deficit: attend ${impact.recoveryClassesNeededAfter ?? '∞'}u consecutive`
                                      : `${impact.immediateSafeBunksAfter} safe skips remain`}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Impact Numbers & Chevron */}
                            <div className="flex shrink-0 items-center gap-3">
                              <div className="text-right">
                                <div className="flex items-center gap-2 font-mono text-sm tabular-nums">
                                  <span className="text-[var(--text-secondary)]">
                                    {formatPercentage(impact.beforePercentage)}
                                  </span>
                                  <span className="text-[var(--text-secondary)]">→</span>
                                  <strong className="font-bold text-[var(--text-main)]">
                                    {formatPercentage(impact.afterPercentage)}
                                  </strong>
                                </div>
                                <div className="mt-0.5 flex items-center justify-end gap-1.5">
                                  <span
                                    className={`font-mono text-xs font-semibold tabular-nums ${
                                      (impact.percentagePointDelta ?? 0) < 0
                                        ? 'text-[var(--status-danger)]'
                                        : 'text-[var(--status-success)]'
                                    }`}
                                  >
                                    {formatPercentagePointDelta(impact.percentagePointDelta)}
                                  </span>
                                </div>
                              </div>

                              <Badge variant={afterStatus.variant}>
                                {afterStatus.label}
                              </Badge>

                              <ChevronDown
                                className={`h-4 w-4 text-[var(--text-secondary)] transition-transform duration-200 ${
                                  isExpanded ? 'rotate-180 text-[var(--primary)]' : ''
                                }`}
                              />
                            </div>
                          </div>
                        </button>

                        {/* Detailed Breakdown Accordion */}
                        <div className="bw-accordion" data-open={isExpanded ? 'true' : 'false'}>
                          <div>
                            <div className="border-t border-[var(--border-subtle)] px-4 pb-3.5 pt-3 text-xs text-[var(--text-secondary)]">
                              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                <div className="rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5">
                                  <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                                    Baseline Units
                                  </p>
                                  <p className="mt-1 font-mono text-sm font-bold tabular-nums text-[var(--text-main)]">
                                    {impact.beforeAttended} / {impact.beforeConducted}
                                  </p>
                                  <p className="text-[10px] text-[var(--text-secondary)]">
                                    Attended / Conducted
                                  </p>
                                </div>

                                <div className="rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5">
                                  <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                                    After Mass Bunk
                                  </p>
                                  <p className="mt-1 font-mono text-sm font-bold tabular-nums text-[var(--text-main)]">
                                    {impact.afterAttended} / {impact.afterConducted}
                                  </p>
                                  <p className="text-[10px] text-[var(--text-secondary)]">
                                    +{impact.missedUnits} missed unit(s)
                                  </p>
                                </div>

                                <div className="rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5">
                                  <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                                    Minimum Threshold
                                  </p>
                                  <p className="mt-1 font-mono text-sm font-bold tabular-nums text-[var(--text-main)]">
                                    {thresholdPercent}%
                                  </p>
                                  <p className="text-[10px] text-[var(--text-secondary)]">
                                    Required minimum
                                  </p>
                                </div>

                                <div className="rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5">
                                  <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                                    {impact.statusAfter === 'danger'
                                      ? 'Recovery Required'
                                      : 'Remaining Safe Margin'}
                                  </p>
                                  <p className="mt-1 font-mono text-sm font-bold tabular-nums text-[var(--text-main)]">
                                    {impact.statusAfter === 'danger'
                                      ? `${impact.recoveryClassesNeededAfter ?? '∞'} units`
                                      : `${impact.immediateSafeBunksAfter} units`}
                                  </p>
                                  <p className="text-[10px] text-[var(--text-secondary)]">
                                    {impact.statusAfter === 'danger'
                                      ? 'consecutive to hit target'
                                      : 'can safely miss next'}
                                  </p>
                                </div>
                              </div>

                              <div className="mt-3 flex items-start gap-2 rounded-[8px] bg-[var(--bg-surface)] p-2.5 text-[11px] leading-relaxed">
                                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--primary)]" />
                                <div>
                                  Before mass bunk: <strong>{impact.beforeAttended}/{impact.beforeConducted}</strong> (
                                  {formatPercentage(impact.beforePercentage)}). Coordinating a skip of{' '}
                                  <strong>{impact.missedUnits} unit(s)</strong> increments conducted classes without attendance, resulting in{' '}
                                  <strong>{impact.afterAttended}/{impact.afterConducted}</strong> (
                                  {formatPercentage(impact.afterPercentage)}).
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

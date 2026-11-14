import { localDateISO } from '../utils/localDate';
import { useMemo, useState } from 'react';
import {
  BookOpen,
  CalendarCheck,
  Check,
  CheckCheck,
  ChevronDown,
  Edit2,
  Plus,
  Rocket,
  Trash2,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  computeSemesterAttendanceReport,
  formatPercentage,
  generateScheduledSessions,
  type AttendanceHealthStatus,
} from '../engine';
import type { AttendanceRecord, AttendanceStatus, Subject } from '../types/domain';
import { SubjectFormModal } from '../components/timetable/SubjectFormModal';
import { LogAttendanceModal } from '../components/attendance/LogAttendanceModal';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Modal,
  ProgressBar,
  Select,
  StatusBanner,
  Tooltip,
  useToast,
  type BadgeVariant,
} from '../components/ui';

function statusBadge(status: AttendanceHealthStatus): {
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

function recordBadgeVariant(status: AttendanceStatus): BadgeVariant {
  switch (status) {
    case 'present':
      return 'success';
    case 'absent':
    case 'mass_bunk':
      return 'danger';
    case 'cancelled':
    case 'holiday':
      return 'neutral';
  }
}

export function MyAttendancePage() {
  const {
    activeSemester,
    subjects,
    timetableEntries,
    calendarEvents,
    attendanceRecords,
    openOnboarding,
    addSubject,
    updateSubject,
    deleteSubject,
    addAttendanceRecord,
    updateAttendanceRecord,
    deleteAttendanceRecord,
  } = useWorkspace();

  const { showToast } = useToast();
  const todayIso = localDateISO();

  const [expandedSubjectId, setExpandedSubjectId] = useState<string | null>(null);
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

  const [logModalOpen, setLogModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [preselectedLogSubjectId, setPreselectedLogSubjectId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Mark all confirmation modal
  const [confirmMarkAllOpen, setConfirmMarkAllOpen] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  // Delete subject confirmation
  const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null);

  // History filters
  const [filterSubjectId, setFilterSubjectId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');

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

  const todaySessions = useMemo(() => {
    if (!activeSemester) return [];
    return generateScheduledSessions({
      semester: activeSemester,
      timetableEntries,
      calendarEvents,
      attendanceRecords,
      fromDate: todayIso,
      toDate: todayIso,
    });
  }, [activeSemester, timetableEntries, calendarEvents, attendanceRecords, todayIso]);

  const subjectById = useMemo(
    () => new Map(subjects.map((s) => [s.id, s])),
    [subjects],
  );

  const filteredHistory = useMemo(() => {
    return [...attendanceRecords]
      .filter((r) => (filterSubjectId === 'all' ? true : r.subjectId === filterSubjectId))
      .filter((r) => (filterStatus === 'all' ? true : r.status === filterStatus))
      .filter((r) => (filterSource === 'all' ? true : r.source === filterSource))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [attendanceRecords, filterSubjectId, filterStatus, filterSource]);

  const unmarkedTodaySessions = useMemo(() => {
    return todaySessions.filter((s) => !s.recordedAttendance && !s.blockedByEvent);
  }, [todaySessions]);

  const handleQuickMark = async (
    subjectId: string,
    timetableEntryId: string,
    units: number,
    status: AttendanceStatus,
    existingRecord: AttendanceRecord | null,
  ) => {
    setActionError(null);
    const subCode = subjectById.get(subjectId)?.code ?? 'Class';
    if (existingRecord) {
      if (existingRecord.status === status) return;
      const res = await updateAttendanceRecord(existingRecord.id, { status });
      if (!res.ok) setActionError(res.error);
      else {
        showToast({
          tone: 'success',
          title: `${subCode} updated`,
          description: `Changed to ${status.replace('_', ' ')} (${units}u).`,
        });
      }
      return;
    }

    const res = await addAttendanceRecord({
      subjectId,
      timetableEntryId,
      date: todayIso,
      status,
      attendanceUnits: units,
      source: 'tracked',
    });
    if (!res.ok) setActionError(res.error);
    else {
      showToast({
        tone: 'success',
        title: `${subCode} marked`,
        description: `Recorded as ${status.replace('_', ' ')} (${units}u).`,
      });
    }
  };

  const handleMarkAllPresent = async () => {
    setMarkingAll(true);
    setActionError(null);
    try {
      for (const session of unmarkedTodaySessions) {
        await addAttendanceRecord({
          subjectId: session.subjectId,
          timetableEntryId: session.timetableEntryId,
          date: todayIso,
          status: 'present',
          attendanceUnits: session.attendanceUnits,
          source: 'tracked',
        });
      }
      showToast({
        tone: 'success',
        title: 'All classes marked',
        description: `Marked ${unmarkedTodaySessions.length} session(s) as Present.`,
      });
      setConfirmMarkAllOpen(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to mark all classes');
    } finally {
      setMarkingAll(false);
    }
  };

  if (!activeSemester || !report) {
    return (
      <div className="space-y-6">
        <div className="border-b border-[var(--border-subtle)] pb-4">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)] sm:text-3xl">
            My Attendance
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Daily attendance recording, subject management, and audit history.
          </p>
        </div>
        <EmptyState
          icon={<BookOpen className="h-5 w-5" />}
          title="No active semester found"
          description="Run the semester onboarding wizard to add your subjects and begin tracking attendance."
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
  const overallBadge = statusBadge(report.overall.status);
  const currentPct = report.overall.percentage;
  const diffFromThreshold = currentPct !== null ? currentPct - thresholdPercent : null;

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-[var(--border-subtle)] pb-5 sm:flex-row sm:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)] sm:text-3xl">
              My Attendance
            </h1>
            {activeSemester.isDemo && (
              <Badge variant="secondary">Demo Mode</Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-[var(--text-secondary)] sm:text-sm">
            {activeSemester.name} &bull; {activeSemester.startDate} to {activeSemester.endDate}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<BookOpen className="h-3.5 w-3.5" />}
            onClick={() => {
              setEditingSubject(null);
              setSubjectModalOpen(true);
            }}
          >
            Add Subject
          </Button>
          <Button
            size="sm"
            disabled={subjects.length === 0}
            leftIcon={<Plus className="h-3.5 w-3.5" />}
            onClick={() => {
              setEditingRecord(null);
              setPreselectedLogSubjectId(null);
              setLogModalOpen(true);
            }}
          >
            Log Attendance
          </Button>
        </div>
      </div>

      {actionError && (
        <StatusBanner
          tone="danger"
          title="Attendance Action Error"
          description={actionError}
        />
      )}

      {/* 2. Compact Attendance Summary (sleek strip, avoids full dashboard duplication) */}
      <Card padding="sm" className="bg-[var(--bg-surface)]">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-[11px] font-medium text-[var(--text-secondary)]">Overall Attendance</p>
              <div className="mt-0.5 flex items-baseline gap-2">
                <span className="font-mono text-2xl font-bold tabular-nums text-[var(--text-main)] sm:text-3xl">
                  {formatPercentage(currentPct)}
                </span>
                <Badge variant={overallBadge.variant}>{overallBadge.label}</Badge>
              </div>
            </div>

            <div className="hidden h-10 w-px bg-[var(--border-subtle)] md:block" />

            <div className="hidden md:block">
              <p className="text-[11px] font-medium text-[var(--text-secondary)]">Requirement</p>
              <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-[var(--text-main)]">
                Min {thresholdPercent}%{' '}
                {diffFromThreshold !== null && (
                  <span
                    className={`text-xs ${
                      diffFromThreshold >= 0
                        ? 'text-[var(--status-success)]'
                        : 'text-[var(--status-danger)]'
                    }`}
                  >
                    ({diffFromThreshold >= 0 ? `+${diffFromThreshold.toFixed(1)}%` : `${diffFromThreshold.toFixed(1)}%`})
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-1 max-w-xs flex-col gap-1.5 sm:px-4">
            <ProgressBar
              value={currentPct ?? 0}
              tone={
                report.overall.status === 'danger'
                  ? 'danger'
                  : report.overall.status === 'borderline'
                    ? 'warning'
                    : 'success'
              }
              size="sm"
            />
            <div className="flex items-center justify-between text-[10px] text-[var(--text-secondary)]">
              <span>{report.overall.attended} Attended</span>
              <span>{report.overall.conducted} Conducted Units</span>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <p className="text-[11px] font-medium text-[var(--text-secondary)]">Current Margin</p>
            <p className="mt-0.5 text-xs font-semibold text-[var(--text-main)]">
              {report.overall.conducted === 0
                ? 'No classes conducted yet'
                : report.overall.recoveryClassesNeeded && report.overall.recoveryClassesNeeded > 0
                  ? `Attend ${report.overall.recoveryClassesNeeded} unit(s) to recover`
                  : `${report.overall.immediateSafeBunks} safe immediate skip(s)`}
            </p>
          </div>
        </div>
      </Card>

      {/* 3. Today's Classes — High Priority */}
      <Card>
        <CardHeader className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle>Today&apos;s Schedule</CardTitle>
              <span className="font-mono text-xs tabular-nums text-[var(--text-secondary)]">
                ({todayIso})
              </span>
            </div>
            <CardDescription>
              Mark each class Present, Absent, Mass Bunk, or Cancelled. Updates records without duplicating slots.
            </CardDescription>
          </div>

          {unmarkedTodaySessions.length > 1 && (
            <Button
              size="sm"
              variant="outline"
              leftIcon={<CheckCheck className="h-3.5 w-3.5 text-[var(--status-success)]" />}
              onClick={() => setConfirmMarkAllOpen(true)}
            >
              Mark All Present ({unmarkedTodaySessions.length})
            </Button>
          )}
        </CardHeader>

        <CardContent>
          {todaySessions.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-well)] px-4 py-6 text-center text-xs text-[var(--text-secondary)]">
              No timetable classes scheduled for today ({todayIso}). Use &ldquo;Log Attendance&rdquo; to record past sessions or extra lectures.
            </div>
          ) : (
            <div className="space-y-2.5">
              {todaySessions.map((session) => {
                const sub = subjectById.get(session.subjectId);
                const rec = session.recordedAttendance;
                return (
                  <div
                    key={session.timetableEntryId}
                    className="flex flex-col justify-between gap-3 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5 shadow-sm transition-all duration-150 hover:border-[var(--border-strong)] sm:flex-row sm:items-center"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: sub?.color ?? 'var(--primary)' }}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-[var(--text-main)]">
                            {sub?.name ?? 'Subject'}
                          </p>
                          <span className="font-mono text-xs text-[var(--text-secondary)]">
                            ({sub?.code})
                          </span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-xs tabular-nums text-[var(--text-secondary)]">
                          <span>
                            {session.startTime}–{session.endTime}
                          </span>
                          <span>&bull;</span>
                          <span className="capitalize">{session.sessionType}</span>
                          <span>&bull;</span>
                          <span>
                            {session.attendanceUnits} unit{session.attendanceUnits === 1 ? '' : 's'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {session.blockedByEvent ? (
                      <Badge variant="warning">
                        Blocked: {session.blockedByEvent.title}
                      </Badge>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(
                          [
                            ['present', 'Present'],
                            ['absent', 'Absent'],
                            ['mass_bunk', 'Mass Bunk'],
                            ['cancelled', 'Cancelled'],
                          ] as const
                        ).map(([st, label]) => {
                          const isSelected = rec?.status === st;

                          let activeClass = '';
                          if (isSelected) {
                            if (st === 'present') {
                              activeClass =
                                'bg-[var(--status-success)]/15 text-[var(--status-success)] border-[var(--status-success)]/40 font-semibold shadow-sm';
                            } else if (st === 'absent' || st === 'mass_bunk') {
                              activeClass =
                                'bg-[var(--status-danger)]/15 text-[var(--status-danger)] border-[var(--status-danger)]/40 font-semibold shadow-sm';
                            } else {
                              activeClass =
                                'bg-[var(--bg-surface-well)] text-[var(--text-main)] border-[var(--border-strong)] font-semibold shadow-sm';
                            }
                          } else {
                            activeClass =
                              'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-main)]';
                          }

                          return (
                            <button
                              key={st}
                              type="button"
                              onClick={() =>
                                void handleQuickMark(
                                  session.subjectId,
                                  session.timetableEntryId,
                                  session.attendanceUnits,
                                  st,
                                  rec,
                                )
                              }
                              className={`inline-flex items-center gap-1 rounded-[8px] border px-2.5 py-1.5 text-xs transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50 ${activeClass}`}
                            >
                              {isSelected && <Check className="h-3 w-3 shrink-0" />}
                              <span>{label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. Subject-Wise Attendance — Hybrid Layout (Compact Rows with Expandable Context) */}
      <Card>
        <CardHeader className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle>Subject-Wise Attendance ({subjects.length})</CardTitle>
            </div>
            <CardDescription>
              Compact subject overview with live threshold progress and full breakdown on expand.
            </CardDescription>
          </div>
          <Badge variant="neutral">
            Threshold: {thresholdPercent}%
          </Badge>
        </CardHeader>

        <CardContent>
          {report.subjectSummaries.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="h-5 w-5 text-[var(--primary)]" />}
              title="No subjects configured yet"
              description="Add your course subjects to begin recording attendance and tracking minimum requirements."
              action={
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingSubject(null);
                    setSubjectModalOpen(true);
                  }}
                >
                  Add Subject
                </Button>
              }
            />
          ) : (
            <div className="space-y-2">
              {report.subjectSummaries.map((item) => {
                const badge = statusBadge(item.status);
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
                      className="w-full p-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        {/* Subject Header */}
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: item.subject.color }}
                          />
                          <span className="truncate text-xs font-semibold text-[var(--text-main)] sm:text-sm">
                            {item.subject.name}
                          </span>
                          <span className="font-mono text-xs text-[var(--text-secondary)]">
                            ({item.subject.code})
                          </span>
                        </div>

                        {/* Attendance Score & Status Badge */}
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="font-mono text-xs tabular-nums text-[var(--text-secondary)]">
                            {item.attended}/{item.conducted} units
                          </span>
                          <span className="font-mono text-sm font-bold tabular-nums text-[var(--text-main)]">
                            {formatPercentage(item.percentage)}
                          </span>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                          <ChevronDown
                            className={`h-4 w-4 text-[var(--text-secondary)] transition-transform duration-200 ${
                              isExpanded ? 'rotate-180 text-[var(--primary)]' : ''
                            }`}
                          />
                        </div>
                      </div>

                      {/* Progress Bar with Threshold Reference Marker */}
                      <div className="mt-3">
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

                      {/* Guidance Strip */}
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
                            ? `Below ${thresholdPercent}% • Attend ${item.recoveryClassesNeeded} consecutive units to recover`
                            : item.status === 'borderline'
                              ? `Borderline • ${item.immediateSafeBunks} safe skip remaining`
                              : item.status === 'no_data'
                                ? 'No sessions conducted yet'
                                : `${item.immediateSafeBunks} safe skip(s) available • Semester budget: ${item.semesterAbsenceBudget} units`}
                        </span>
                        <span className="font-mono text-[10px] text-[var(--text-secondary)]">
                          {item.remainingScheduledUnits} upcoming units
                        </span>
                      </div>
                    </button>

                    {/* Expandable Breakdown and Management */}
                    <div className="bw-accordion" data-open={isExpanded ? 'true' : 'false'}>
                      <div>
                        <div className="border-t border-[var(--border-subtle)] px-4 pb-3.5 pt-3 text-xs text-[var(--text-secondary)]">
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <div>
                              <p className="text-[10px] font-medium text-[var(--text-secondary)]">Attended / Conducted</p>
                              <p className="mt-0.5 font-mono font-semibold tabular-nums text-[var(--text-main)]">
                                {item.attended} / {item.conducted} units
                              </p>
                            </div>

                            <div>
                              <p className="text-[10px] font-medium text-[var(--text-secondary)]">Missed / Bunked</p>
                              <p className="mt-0.5 font-mono font-semibold tabular-nums text-[var(--status-danger)]">
                                {item.missed} units
                              </p>
                            </div>

                            <div>
                              <p className="text-[10px] font-medium text-[var(--text-secondary)]">Historical Baseline</p>
                              <p className="mt-0.5 font-mono font-semibold tabular-nums text-[var(--text-main)]">
                                {item.historicalAttended}/{item.historicalConducted} units
                              </p>
                            </div>

                            <div>
                              <p className="text-[10px] font-medium text-[var(--text-secondary)]">Max Projected</p>
                              <p className="mt-0.5 font-mono font-semibold tabular-nums text-[var(--text-main)]">
                                {formatPercentage(item.projectedIfAttendAllPercentage)}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-2.5">
                            <span className="text-[11px] text-[var(--text-secondary)]">
                              Tracked sessions: {item.trackedAttended} attended, {item.trackedMassBunkUnits}u mass bunk, {item.trackedCancelledUnits}u cancelled
                            </span>

                            <div className="flex items-center gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                leftIcon={<Edit2 className="h-3 w-3" />}
                                onClick={() => {
                                  setEditingSubject(item.subject);
                                  setSubjectModalOpen(true);
                                }}
                              >
                                Edit Subject
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                leftIcon={<Plus className="h-3 w-3" />}
                                onClick={() => {
                                  setEditingRecord(null);
                                  setPreselectedLogSubjectId(item.subject.id);
                                  setLogModalOpen(true);
                                }}
                              >
                                Log Attendance
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-[var(--status-danger)] hover:bg-[var(--status-danger)]/10"
                                leftIcon={<Trash2 className="h-3 w-3" />}
                                onClick={() => setSubjectToDelete(item.subject)}
                              >
                                Delete
                              </Button>
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

        {/* 5. Attendance History (Filterable, Compact Rows) */}
        <Card>
          <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Attendance History ({filteredHistory.length})</CardTitle>
              <CardDescription>
                Filter, inspect session notes, edit past records, or remove mistaken entries.
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={filterSubjectId}
                onChange={(e) => setFilterSubjectId(e.target.value)}
                className="w-32 sm:w-36"
              >
                <option value="all">All Subjects</option>
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.code}
                  </option>
                ))}
              </Select>
              <Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-32 sm:w-36"
              >
                <option value="all">All Statuses</option>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="mass_bunk">Mass Bunk</option>
                <option value="cancelled">Cancelled</option>
                <option value="holiday">Holiday</option>
              </Select>
              <Select
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value)}
                className="w-32 sm:w-36"
              >
                <option value="all">All Sources</option>
                <option value="tracked">Tracked</option>
                <option value="historical_log">Historical Audit</option>
              </Select>
            </div>
          </CardHeader>

          <CardContent>
            {filteredHistory.length === 0 ? (
              <div className="rounded-[10px] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-well)] px-4 py-8 text-center text-xs text-[var(--text-secondary)]">
                No attendance records match the selected filters.
              </div>
            ) : (
              <div className="space-y-2">
                {filteredHistory.map((rec) => {
                  const sub = subjectById.get(rec.subjectId);
                  return (
                    <div
                      key={rec.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2.5 text-xs transition-all duration-150 hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)]"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: sub?.color ?? 'var(--primary)' }}
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono font-bold tabular-nums text-[var(--text-main)]">
                              {rec.date}
                            </span>
                            <span className="font-semibold text-[var(--text-main)]">
                              {sub ? `${sub.name} (${sub.code})` : 'Subject'}
                            </span>
                            <Badge
                              variant={recordBadgeVariant(rec.status)}
                              className="capitalize"
                            >
                              {rec.status.replace('_', ' ')}
                            </Badge>
                            <Badge variant="neutral">
                              {rec.attendanceUnits} unit{rec.attendanceUnits === 1 ? '' : 's'}
                            </Badge>
                            {rec.source === 'historical_log' && (
                              <Badge variant="secondary">Historical Audit</Badge>
                            )}
                          </div>
                          {rec.notes && (
                            <p className="mt-0.5 truncate text-[11px] text-[var(--text-secondary)]">
                              {rec.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <Tooltip content="Edit record">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingRecord(rec);
                              setPreselectedLogSubjectId(null);
                              setLogModalOpen(true);
                            }}
                            aria-label={`Edit attendance on ${rec.date}`}
                            className="rounded-[8px] p-1.5 text-[var(--text-secondary)] transition-all duration-150 hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-main)] active:scale-95"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        </Tooltip>
                        <Tooltip content="Delete record">
                          <button
                            type="button"
                            onClick={async () => {
                              await deleteAttendanceRecord(rec.id);
                              showToast({
                                tone: 'info',
                                title: 'Attendance record removed',
                                description: `${rec.date} (${rec.attendanceUnits}u)`,
                              });
                            }}
                            aria-label={`Delete record on ${rec.date}`}
                            className="rounded-[8px] p-1.5 text-[var(--text-secondary)] transition-all duration-150 hover:bg-[var(--status-danger)]/15 hover:text-[var(--status-danger)] active:scale-95"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-[var(--status-danger)]" />
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

      {/* Confirmation Modal: Mark All Unmarked as Present */}
      <Modal
        open={confirmMarkAllOpen}
        onClose={() => setConfirmMarkAllOpen(false)}
        title="Mark All Unmarked Classes as Present?"
        description={`This will record ${unmarkedTodaySessions.length} session(s) as Present for today (${todayIso}).`}
      >
        <div className="space-y-4">
          <div className="space-y-2 rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface-well)] p-3 text-xs">
            {unmarkedTodaySessions.map((session) => {
              const sub = subjectById.get(session.subjectId);
              return (
                <div key={session.timetableEntryId} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: sub?.color ?? 'var(--primary)' }}
                    />
                    <span className="font-semibold text-[var(--text-main)]">
                      {sub?.name} ({sub?.code})
                    </span>
                  </div>
                  <span className="font-mono tabular-nums text-[var(--text-secondary)]">
                    {session.startTime}–{session.endTime} ({session.attendanceUnits}u)
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setConfirmMarkAllOpen(false)}
              disabled={markingAll}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleMarkAllPresent()}
              isLoading={markingAll}
              leftIcon={<Check className="h-3.5 w-3.5" />}
            >
              Confirm Mark All
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirmation Modal: Delete Subject */}
      <Modal
        open={Boolean(subjectToDelete)}
        onClose={() => setSubjectToDelete(null)}
        title={`Delete ${subjectToDelete?.name}?`}
        description={`Are you sure you want to delete ${subjectToDelete?.name} (${subjectToDelete?.code})? Timetable slots and attendance records associated with this subject will be removed.`}
      >
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => setSubjectToDelete(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              if (subjectToDelete) {
                await deleteSubject(subjectToDelete.id);
                showToast({
                  tone: 'info',
                  title: `Deleted ${subjectToDelete.code}`,
                });
                setSubjectToDelete(null);
              }
            }}
          >
            Delete Subject
          </Button>
        </div>
      </Modal>

      {/* Edit / Add Subject Modal */}
      <SubjectFormModal
        open={subjectModalOpen}
        onClose={() => setSubjectModalOpen(false)}
        initialSubject={editingSubject}
        allowHistoricalEdit={activeSemester.mode === 'ongoing'}
        onSubmitSubject={async (data) => {
          const res = editingSubject
            ? await updateSubject(editingSubject.id, data)
            : await addSubject(data);
          if (res.ok) {
            showToast({
              tone: 'success',
              title: editingSubject ? 'Subject updated' : 'Subject added',
              description: `${data.name} (${data.code})`,
            });
          }
          return res;
        }}
      />

      {/* Log Attendance Modal */}
      <LogAttendanceModal
        open={logModalOpen}
        onClose={() => {
          setLogModalOpen(false);
          setPreselectedLogSubjectId(null);
        }}
        semester={activeSemester}
        subjects={subjects}
        timetableEntries={timetableEntries}
        initialRecord={
          editingRecord ??
          (preselectedLogSubjectId
            ? ({
                id: '',
                semesterId: activeSemester.id,
                subjectId: preselectedLogSubjectId,
                date: todayIso,
                status: 'present',
                attendanceUnits: 1,
                source: 'tracked',
              } as AttendanceRecord)
            : null)
        }
        onSave={async (data) => {
          const res = editingRecord
            ? await updateAttendanceRecord(editingRecord.id, data)
            : await addAttendanceRecord(data);
          if (res.ok) {
            const subjectCode = subjects.find((subject) => subject.id === data.subjectId)?.code;
            const actionLabel = editingRecord ? 'Record updated' : 'Attendance logged';
            showToast({
              tone: 'success',
              title: subjectCode ? `${actionLabel} for ${subjectCode}` : actionLabel,
              description: `${data.date} • ${data.status.replace('_', ' ')} (${data.attendanceUnits}u)`,
            });
          }
          return res;
        }}
      />
    </div>
  );
}

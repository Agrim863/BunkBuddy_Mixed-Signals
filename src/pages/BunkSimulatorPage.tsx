import { localDateISO } from '../utils/localDate';
import { useMemo, useState } from 'react';
import {
  Calendar,
  ChevronDown,
  FlaskConical,
  HelpCircle,
  Info,
  Minus,
  Plus,
  Rocket,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useSimulation } from '../context/SimulationContext';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  computeSemesterAttendanceReport,
  formatPercentage,
  formatPercentagePointDelta,
  getSessionKey,
  simulateBunkScenario,
  type AttendanceHealthStatus,
  type SimulationHorizon,
} from '../engine';
import { getWeekdayShortName } from '../utils/weekdays';
import { PageHeader } from '../components/layout/PageHeader';
import { ScenarioComparisonChart } from '../components/simulator/ScenarioComparisonChart';
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
  Select,
  StatusBanner,
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

export function BunkSimulatorPage() {
  const { showToast } = useToast();
  const {
    activeSemester,
    subjects,
    timetableEntries,
    calendarEvents,
    attendanceRecords,
    openOnboarding,
  } = useWorkspace();

  const {
    focusSubjectId,
    setFocusSubjectId,
    singleDate,
    setSingleDate,
    selectedSessionKeys,
    toggleSessionKey,
    setSelectedSessionKeys,
    extraMissedUnits,
    setExtraMissedUnits,
    otherUpcomingAttendRate,
    setOtherUpcomingAttendRate,
    horizon,
    setHorizon,
    resetBunkSimulation,
  } = useSimulation();

  // Expanded explanations state for Scenario cards
  const [expandedScenarios, setExpandedScenarios] = useState<Record<string, boolean>>({
    A: false,
    B: false,
    C: false,
  });

  const toggleScenarioExpand = (key: string) => {
    setExpandedScenarios((prev) => ({ ...prev, [key]: !prev[key] }));
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

  const subjectById = useMemo(
    () => new Map(subjects.map((s) => [s.id, s])),
    [subjects],
  );

  const simulation = useMemo(() => {
    if (!report) return null;
    return simulateBunkScenario({
      report,
      focusSubjectId,
      singleDate,
      selectedSessionKeys,
      extraMissedUnits,
      otherUpcomingAttendRate,
      horizon,
    });
  }, [
    report,
    focusSubjectId,
    singleDate,
    selectedSessionKeys,
    extraMissedUnits,
    otherUpcomingAttendRate,
    horizon,
  ]);

  const visibleUpcomingLectures = useMemo(() => {
    if (!report) return [];
    return report.upcomingSessions.filter((session) => {
      if (focusSubjectId === 'all') return true;
      return session.subjectId === focusSubjectId;
    });
  }, [report, focusSubjectId]);

  const quickUpcomingDates = useMemo(() => {
    const dates = Array.from(new Set(visibleUpcomingLectures.map((s) => s.date)));
    return dates.sort();
  }, [visibleUpcomingLectures]);

  const selectAllOnDate = () => {
    if (!singleDate) return;
    const keysOnDate = visibleUpcomingLectures
      .filter((s) => s.date === singleDate)
      .map(getSessionKey);
    const set = new Set([...selectedSessionKeys, ...keysOnDate]);
    setSelectedSessionKeys(Array.from(set));
    showToast({
      tone: 'info',
      title: 'Target day selected',
      description: `Added all lectures on ${singleDate}.`,
    });
  };

  if (!activeSemester || !report || !simulation) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Bunk Simulator"
          description="Model safe bunks, multi-day skips, and threshold recovery without touching real data."
        />
        <EmptyState
          icon={<FlaskConical className="h-5 w-5" />}
          title="No Active Semester"
          description="Create or select an active semester to run safe bunk simulations and what-if scenarios."
          action={
            <Button leftIcon={<Rocket className="h-4 w-4" />} onClick={openOnboarding}>
              Launch Setup Wizard
            </Button>
          }
        />
      </div>
    );
  }

  const thresholdPercent = Math.round(activeSemester.minimumAttendance * 100);
  const simStatusBadge = statusBadgeProps(simulation.primary.status);
  const overallStatusBadge = statusBadgeProps(simulation.overall.status);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bunk Simulator"
        description={`${activeSemester.name} • Live hypothetical attendance modeling sandbox.`}
        badge={
          <Badge variant="primary" dot>
            <ShieldCheck className="h-3 w-3" />
            Sandbox Mode
          </Badge>
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
            onClick={() => {
              resetBunkSimulation();
              showToast({
                tone: 'info',
                title: 'Simulation reset',
                description: 'All hypothetical bunk selections cleared.',
              });
            }}
          >
            Reset Simulation
          </Button>
        }
      />

      <StatusBanner
        tone="info"
        title="Simulations Never Alter Historical Records"
        description="All inputs below run in an isolated in-memory projection. Your recorded attendance logs and baselines remain completely untouched."
      />

      {/* Two-Column Responsive Workspace */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* LEFT COLUMN: SIMULATION WORKSPACE */}
        <div className="space-y-5 xl:col-span-5">
          <Card>
            <CardHeader className="pb-3.5">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-[var(--primary)]" />
                <CardTitle>Simulation Workspace</CardTitle>
              </div>
              <CardDescription>
                Adjust scope, target date, missed units, and future attendance assumptions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Scope & Horizon Group */}
              <div className="space-y-3 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface-well)] p-3.5">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  1. Scope &amp; Horizon
                </span>

                <Select
                  label="Focus Subject"
                  value={focusSubjectId}
                  onChange={(e) => setFocusSubjectId(e.target.value)}
                >
                  <option value="all">Overall Semester (All Subjects)</option>
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name} ({sub.code})
                    </option>
                  ))}
                </Select>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Input
                      label="Target Date (Scenario B)"
                      type="date"
                      min={activeSemester.startDate}
                      max={activeSemester.endDate}
                      value={singleDate}
                      onChange={(e) => setSingleDate(e.target.value)}
                    />
                    {quickUpcomingDates.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {quickUpcomingDates.slice(0, 4).map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setSingleDate(d)}
                            className={`rounded-[6px] border px-2 py-0.5 font-mono text-[11px] tabular-nums transition-all duration-150 active:scale-95 ${
                              singleDate === d
                                ? 'border-[var(--primary)] bg-[var(--primary)]/15 font-semibold text-[var(--primary)]'
                                : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-main)]'
                            }`}
                          >
                            {d.slice(5)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <Select
                    label="Forecast Horizon"
                    value={horizon}
                    onChange={(e) => setHorizon(e.target.value as SimulationHorizon)}
                  >
                    <option value="immediate">Immediate (Missed Only)</option>
                    <option value="next_14_days">Next 14 Days</option>
                    <option value="next_30_days">Next 30 Days</option>
                    <option value="semester_end">End of Semester</option>
                  </Select>
                </div>
              </div>

              {/* Hypothetical Skips & Assumption Group */}
              <div className="space-y-3.5 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface-well)] p-3.5">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  2. Absence Load &amp; Future Rate
                </span>

                {/* Extra Missed Units Stepper */}
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-main)]">
                      Additional Units to Miss
                    </p>
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      Extra hypothetical skips on top of selected lectures
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label="Decrease missed units"
                      className="h-8 w-8 p-0"
                      onClick={() =>
                        setExtraMissedUnits(Math.max(0, extraMissedUnits - 1))
                      }
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <input
                      type="number"
                      min={0}
                      max={40}
                      value={extraMissedUnits}
                      onChange={(e) =>
                        setExtraMissedUnits(Math.max(0, Number(e.target.value)))
                      }
                      className="h-8 w-14 rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 text-center font-mono text-sm font-bold tabular-nums text-[var(--text-main)] focus:border-[var(--primary)] focus:outline-none"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label="Increase missed units"
                      className="h-8 w-8 p-0"
                      onClick={() => setExtraMissedUnits(extraMissedUnits + 1)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Upcoming Attendance Rate Assumption */}
                <div className="border-t border-[var(--border-subtle)] pt-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-[var(--text-main)]">
                        Attendance Rate on Other Upcoming Classes
                      </p>
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        {horizon === 'immediate'
                          ? 'Inactive in immediate horizon'
                          : 'Forecast assumption for remaining sessions'}
                      </p>
                    </div>
                    <Badge variant="primary" className="font-mono tabular-nums">
                      {Math.round(otherUpcomingAttendRate * 100)}%
                    </Badge>
                  </div>

                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={Math.round(otherUpcomingAttendRate * 100)}
                    disabled={horizon === 'immediate'}
                    onChange={(e) =>
                      setOtherUpcomingAttendRate(Number(e.target.value) / 100)
                    }
                    className="mt-2.5 w-full accent-[var(--primary)] disabled:opacity-40"
                  />

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[100, 90, 80, 75, 50].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        disabled={horizon === 'immediate'}
                        onClick={() => setOtherUpcomingAttendRate(pct / 100)}
                        className={`rounded-[6px] border px-2 py-0.5 font-mono text-[11px] font-medium transition-all duration-150 active:scale-95 disabled:opacity-40 ${
                          Math.round(otherUpcomingAttendRate * 100) === pct
                            ? 'border-[var(--primary)] bg-[var(--primary)]/15 font-semibold text-[var(--primary)]'
                            : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-main)]'
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Multi-Lecture Selection Across Days */}
              <div className="space-y-2.5 pt-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-[var(--primary)]" />
                    <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                      Select Lectures Across Days ({selectedSessionKeys.length})
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={selectAllOnDate}
                      className="rounded-[6px] px-2 py-1 text-[11px] font-semibold text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/10"
                    >
                      Select Target Day
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedSessionKeys([])}
                      className="rounded-[6px] px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-main)]"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {visibleUpcomingLectures.length === 0 ? (
                  <div className="rounded-[10px] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-well)] px-4 py-5 text-center text-xs text-[var(--text-secondary)]">
                    No unlogged upcoming lectures found for this scope. Use &ldquo;Additional Units to Miss&rdquo; above to simulate custom skips.
                  </div>
                ) : (
                  <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                    {visibleUpcomingLectures.map((session) => {
                      const key = getSessionKey(session);
                      const checked = selectedSessionKeys.includes(key);
                      const sub = subjectById.get(session.subjectId);
                      const isTargetDay = session.date === singleDate;
                      return (
                        <label
                          key={key}
                          className={`flex cursor-pointer items-center justify-between gap-2 rounded-[10px] border px-3 py-2 text-xs transition-all duration-150 active:scale-[0.99] ${
                            checked
                              ? 'border-[var(--primary)] bg-[var(--primary)]/10 font-semibold'
                              : isTargetDay
                                ? 'border-[var(--secondary)]/60 bg-[var(--secondary)]/20'
                                : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)]'
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleSessionKey(key)}
                              className="h-4 w-4 rounded border-[var(--border-subtle)] accent-[var(--primary)]"
                            />
                            {sub && (
                              <span
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{ backgroundColor: sub.color }}
                              />
                            )}
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-[var(--text-main)]">
                                {sub ? `${sub.name} (${sub.code})` : 'Subject'}
                              </p>
                              <p className="font-mono tabular-nums text-[11px] text-[var(--text-secondary)]">
                                {getWeekdayShortName(session.weekday)} {session.date} •{' '}
                                {session.startTime}–{session.endTime}
                              </p>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            {isTargetDay && <Badge variant="secondary">Day B</Badge>}
                            <Badge variant="neutral">{session.attendanceUnits}u</Badge>
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

        {/* RIGHT COLUMN: LIVE PROJECTED RESULT & SCENARIOS */}
        <div className="space-y-6 xl:col-span-7">
          {/* Primary Live Projected Result Hero Card */}
          <Card>
            <CardHeader className="pb-3.5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--primary)]">
                    Live Simulation Output
                  </span>
                  <span className="text-[var(--border-strong)]">•</span>
                  <span className="text-xs font-medium text-[var(--text-secondary)]">
                    {simulation.scopeLabel}
                  </span>
                </div>
                <CardTitle className="mt-0.5">Projected Attendance Result</CardTitle>
                <CardDescription>
                  {simulation.primary.description}
                </CardDescription>
              </div>
              <Badge variant={simStatusBadge.variant} dot>
                {simStatusBadge.label}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Visual Before vs After Strip */}
              <div className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface-well)] p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                        Baseline
                      </span>
                      <p className="font-mono text-base font-bold tabular-nums text-[var(--text-main)]">
                        {formatPercentage(simulation.primary.currentPercentage)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-[var(--text-secondary)]">→</span>
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--primary)]">
                        Simulated
                      </span>
                      <p className="font-mono text-base font-bold tabular-nums text-[var(--text-main)]">
                        {formatPercentage(simulation.primary.simulatedPercentage)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 font-mono text-xs font-bold tabular-nums ${
                        (simulation.primary.percentagePointDelta ?? 0) < 0
                          ? 'text-[var(--status-danger)]'
                          : 'text-[var(--status-success)]'
                      }`}
                    >
                      {(simulation.primary.percentagePointDelta ?? 0) < 0 ? (
                        <TrendingDown className="h-3.5 w-3.5" />
                      ) : (
                        <TrendingUp className="h-3.5 w-3.5" />
                      )}
                      {formatPercentagePointDelta(simulation.primary.percentagePointDelta)}
                    </span>
                    <Badge variant={simStatusBadge.variant}>
                      {simStatusBadge.label}
                    </Badge>
                  </div>
                </div>

                <div className="mt-2.5">
                  <ProgressBar
                    value={simulation.primary.simulatedPercentage ?? 0}
                    tone={
                      simulation.primary.status === 'danger'
                        ? 'danger'
                        : simulation.primary.status === 'borderline'
                          ? 'warning'
                          : 'success'
                    }
                    size="sm"
                  />
                </div>
              </div>

              {/* 4-Metric Grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                    Current Attendance
                  </p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-[var(--text-main)]">
                    {formatPercentage(simulation.primary.currentPercentage)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                    Threshold: {thresholdPercent}%
                  </p>
                </div>

                <div
                  className={`rounded-[10px] border p-3 transition-colors duration-200 ${
                    simulation.primary.status === 'danger'
                      ? 'border-[var(--status-danger)]/40 bg-[var(--status-danger)]/10'
                      : simulation.primary.status === 'borderline'
                        ? 'border-[var(--status-warning)]/40 bg-[var(--status-warning)]/10'
                        : 'border-[var(--primary)]/45 bg-[var(--primary)]/10'
                  }`}
                >
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--primary)]">
                    Simulated Result
                  </p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-[var(--text-main)]">
                    {formatPercentage(simulation.primary.simulatedPercentage)}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] tabular-nums text-[var(--text-secondary)]">
                    {simulation.primary.attended}/{simulation.primary.conducted} units
                  </p>
                </div>

                <div className="rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                    Net Impact
                  </p>
                  <p
                    className={`mt-1 text-xl font-bold tabular-nums ${
                      (simulation.primary.percentagePointDelta ?? 0) < 0
                        ? 'text-[var(--status-danger)]'
                        : 'text-[var(--status-success)]'
                    }`}
                  >
                    {formatPercentagePointDelta(simulation.primary.percentagePointDelta)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                    Percentage point change
                  </p>
                </div>

                <div className="rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                    {simulation.primary.status === 'danger'
                      ? 'Recovery Needed'
                      : 'Remaining Margin'}
                  </p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-[var(--text-main)]">
                    {simulation.primary.status === 'danger'
                      ? simulation.primary.recoveryClassesNeeded === null
                        ? '∞'
                        : `${simulation.primary.recoveryClassesNeeded}u`
                      : `${simulation.primary.immediateSafeBunksAfter}u`}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                    {simulation.primary.status === 'danger'
                      ? `consecutive units to hit ${thresholdPercent}%`
                      : `semester budget: ${simulation.primary.semesterAbsenceBudgetAfter}u`}
                  </p>
                </div>
              </div>

              {/* Consolidated Overall Impact (when focusing on a single subject) */}
              {focusSubjectId !== 'all' && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface-well)] px-4 py-2.5 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5 text-[var(--primary)]" />
                    <span className="font-semibold text-[var(--text-main)]">
                      Consolidated Overall Semester Impact:
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 font-mono tabular-nums">
                    <span className="text-[var(--text-secondary)]">
                      {formatPercentage(simulation.overall.currentPercentage)} →{' '}
                      <strong className="text-[var(--text-main)]">
                        {formatPercentage(simulation.overall.simulatedPercentage)}
                      </strong>
                    </span>
                    <span className="text-[var(--text-secondary)]">
                      ({formatPercentagePointDelta(simulation.overall.percentagePointDelta)})
                    </span>
                    <Badge variant={overallStatusBadge.variant}>
                      {overallStatusBadge.label}
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Scenario A / B / C Comparison Cards */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Scenario Comparison (A, B, C)
              </span>
              <span className="text-xs text-[var(--text-secondary)]">
                Click cards or badges to view calculation breakdown
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {(['A', 'B', 'C'] as const).map((key) => {
                const sc = simulation.scenarios[key];
                const badge = statusBadgeProps(sc.status);
                const isExpanded = !!expandedScenarios[key];

                return (
                  <Card
                    key={key}
                    padding="sm"
                    className="flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--primary)]/60 hover:shadow-md"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <Badge
                          variant={
                            key === 'A'
                              ? 'success'
                              : key === 'B'
                                ? 'secondary'
                                : 'primary'
                          }
                        >
                          Scenario {key}
                        </Badge>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </div>

                      <h4 className="mt-2.5 text-sm font-semibold text-[var(--text-main)]">
                        {key === 'A'
                          ? 'Attend All Upcoming'
                          : key === 'B'
                            ? `Miss ${singleDate || 'Target Day'}`
                            : 'Miss Multi-Day Selection'}
                      </h4>
                      <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                        {sc.description}
                      </p>
                    </div>

                    <div className="mt-4 border-t border-[var(--border-subtle)] pt-3">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xl font-bold tabular-nums text-[var(--text-main)]">
                          {formatPercentage(sc.simulatedPercentage)}
                        </span>
                        <span
                          className={`font-mono text-xs font-semibold tabular-nums ${
                            (sc.percentagePointDelta ?? 0) < 0
                              ? 'text-[var(--status-danger)]'
                              : 'text-[var(--status-success)]'
                          }`}
                        >
                          {formatPercentagePointDelta(sc.percentagePointDelta)}
                        </span>
                      </div>

                      <p className="mt-1 font-mono text-[11px] tabular-nums text-[var(--text-secondary)]">
                        {sc.attended}/{sc.conducted} units •{' '}
                        {sc.status === 'danger'
                          ? `Need ${sc.recoveryClassesNeeded ?? '∞'} to recover`
                          : `${sc.immediateSafeBunksAfter} safe skips left`}
                      </p>

                      {/* Expandable Explanation Toggle */}
                      <button
                        type="button"
                        onClick={() => toggleScenarioExpand(key)}
                        aria-expanded={isExpanded}
                        className="mt-2.5 flex w-full items-center justify-between rounded-[8px] bg-[var(--bg-surface-well)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)] transition-colors hover:text-[var(--text-main)]"
                      >
                        <span className="flex items-center gap-1">
                          <HelpCircle className="h-3 w-3 text-[var(--primary)]" />
                          {isExpanded ? 'Hide explanation' : 'Why this outcome?'}
                        </span>
                        <ChevronDown
                          className={`h-3.5 w-3.5 transition-transform duration-200 ${
                            isExpanded ? 'rotate-180 text-[var(--primary)]' : ''
                          }`}
                        />
                      </button>

                      {/* Expandable Breakdown Drawer */}
                      <div className="bw-accordion" data-open={isExpanded ? 'true' : 'false'}>
                        <div>
                          <div className="mt-2 space-y-1.5 rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-surface-well)] p-2.5 text-[11px] text-[var(--text-secondary)]">
                            <div className="flex justify-between font-mono">
                              <span>Missed in scenario:</span>
                              <strong className="text-[var(--text-main)]">
                                {sc.missedUnitsInScenario} units
                              </strong>
                            </div>
                            <div className="flex justify-between font-mono">
                              <span>Attended in future:</span>
                              <strong className="text-[var(--text-main)]">
                                {sc.attendedFutureUnitsInScenario} units
                              </strong>
                            </div>
                            <div className="flex justify-between font-mono">
                              <span>Safe margin after:</span>
                              <strong className="text-[var(--text-main)]">
                                {sc.status === 'danger'
                                  ? `Deficit: attend ${sc.recoveryClassesNeeded ?? '∞'}u`
                                  : `${sc.immediateSafeBunksAfter} immediate skips`}
                              </strong>
                            </div>
                            <p className="border-t border-[var(--border-subtle)] pt-1.5 text-[10px] leading-relaxed">
                              {key === 'A'
                                ? 'Best-case projection assuming zero further unexcused absences until the horizon cutoff.'
                                : key === 'B'
                                  ? `Simulates skipping all scheduled lectures on ${singleDate || 'the selected date'} and attending other classes at your configured rate.`
                                  : 'Simulates skipping specifically selected multi-day lectures plus any additional unit offsets.'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Scenario Comparison Chart */}
          <ScenarioComparisonChart
            currentPercentage={simulation.primary.currentPercentage}
            scenarios={simulation.scenarios}
            thresholdPercent={thresholdPercent}
            scopeLabel={simulation.scopeLabel}
          />
        </div>
      </div>
    </div>
  );
}

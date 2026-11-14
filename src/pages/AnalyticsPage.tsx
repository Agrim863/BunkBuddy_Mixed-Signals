import { localDateISO } from '../utils/localDate';
import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Rocket,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useShell } from '../context/ShellContext';
import {
  buildCombinedTrajectorySeries,
  buildRecoveryCurveSeries,
  buildSubjectComparisonData,
  computeSemesterAttendanceReport,
  formatPercentage,
} from '../engine';
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
  Select,
} from '../components/ui';

export function AnalyticsPage() {
  const {
    activeSemester,
    subjects,
    timetableEntries,
    calendarEvents,
    attendanceRecords,
    openOnboarding,
  } = useWorkspace();

  const { resolvedTheme } = useShell();
  const isDark = resolvedTheme === 'dark';

  const gridStroke = isDark ? '#3F3430' : '#E5DFD9';
  const tickFill = isDark ? '#AFA49F' : '#786B66';
  const tooltipBg = isDark ? '#2E2320' : '#FDFCFB';
  const tooltipBorder = isDark ? '#3F3430' : '#E5DFD9';
  const textColor = isDark ? '#F7F5F2' : '#2E2320';
  const warningColor = isDark ? '#F3BF6E' : '#7D4F00';
  const primaryColor = isDark ? '#B67EB7' : '#6D3B6E';
  const successColor = isDark ? '#75C99E' : '#1A5A38';
  const dangerColor = isDark ? '#F28D85' : '#8E2323';
  const neutralColor = isDark ? '#4D3E3A' : '#E5DFD9';

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

  const trajectorySeries = useMemo(() => {
    if (!activeSemester || !report) return [];
    return buildCombinedTrajectorySeries({
      semester: activeSemester,
      subjects,
      attendanceRecords,
      report,
    });
  }, [activeSemester, subjects, attendanceRecords, report]);

  const subjectComparison = useMemo(() => {
    if (!report) return [];
    return buildSubjectComparisonData(report);
  }, [report]);

  const defaultRecoverySubjectId = useMemo(() => {
    if (!report) return '';
    return (
      report.overall.subjectsBelowThreshold[0]?.subject.id ??
      report.subjectSummaries[0]?.subject.id ??
      ''
    );
  }, [report]);

  const [recoverySubjectId, setRecoverySubjectId] = useState<string>('');
  const activeRecoveryId =
    subjects.some((s) => s.id === recoverySubjectId)
      ? recoverySubjectId
      : defaultRecoverySubjectId;

  const recoverySummary = useMemo(() => {
    if (!report || !activeRecoveryId) return null;
    return (
      report.subjectSummaries.find((s) => s.subject.id === activeRecoveryId) ??
      null
    );
  }, [report, activeRecoveryId]);

  const recoveryCurve = useMemo(() => {
    if (!activeSemester || !recoverySummary) return [];
    return buildRecoveryCurveSeries(recoverySummary, activeSemester.minimumAttendance, 15);
  }, [activeSemester, recoverySummary]);

  if (!activeSemester) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Analytics"
          description="Attendance trends, subject comparisons, and recovery projections."
        />
        <EmptyState
          icon={<BarChart3 className="h-6 w-6" />}
          title="No Active Semester"
          description="Create or select a semester to visualize analytics and recovery curves."
          action={
            <Button
              variant="primary"
              leftIcon={<Rocket className="h-4 w-4" />}
              onClick={openOnboarding}
            >
              Launch Setup Wizard
            </Button>
          }
        />
      </div>
    );
  }

  const thresholdPercent = Math.round(activeSemester.minimumAttendance * 100);

  // Top Compact Summaries
  const belowCount = report?.overall.subjectsBelowThreshold.length ?? 0;
  const borderlineCount = report?.overall.subjectsBorderline.length ?? 0;
  const atRiskTotal = belowCount + borderlineCount;

  const totalRecoveryDeficit = report
    ? report.overall.subjectsBelowThreshold.reduce(
        (sum, s) => sum + (s.recoveryClassesNeeded ?? 0),
        0,
      )
    : 0;

  const projectedSemesterEnd = report?.overall.projectedIfAttendAllPercentage ?? null;
  const safeBunksRemaining = report?.overall.immediateSafeBunks ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description={`${activeSemester.name} • Executive attendance trajectory, risk forecasting, and recovery curves.`}
        badge={
          <Badge variant="primary">
            Threshold: {thresholdPercent}%
          </Badge>
        }
      />

      {/* Top Compact Summary Strip (Derived from real calculations) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Metric 1: Projected Semester End */}
        <div className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Projected Final
            </span>
            <Activity className="h-3.5 w-3.5 text-[var(--primary)]" />
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--text-main)]">
            {formatPercentage(projectedSemesterEnd)}
          </p>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            Assuming 100% of future classes
          </p>
        </div>

        {/* Metric 2: Subjects At Risk */}
        <div
          className={`rounded-[12px] border p-3.5 shadow-xs transition-colors ${
            belowCount > 0
              ? 'border-[var(--status-danger)]/40 bg-[var(--status-danger)]/10'
              : borderlineCount > 0
                ? 'border-[var(--status-warning)]/40 bg-[var(--status-warning)]/10'
                : 'border-[var(--border-subtle)] bg-[var(--bg-surface)]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`font-mono text-[10px] font-semibold uppercase tracking-wider ${
                belowCount > 0
                  ? 'text-[var(--status-danger)]'
                  : borderlineCount > 0
                    ? 'text-[var(--status-warning)]'
                    : 'text-[var(--text-secondary)]'
              }`}
            >
              Subjects At Risk
            </span>
            <AlertTriangle
              className={`h-3.5 w-3.5 ${
                belowCount > 0
                  ? 'text-[var(--status-danger)]'
                  : borderlineCount > 0
                    ? 'text-[var(--status-warning)]'
                    : 'text-[var(--text-secondary)]'
              }`}
            />
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--text-main)]">
            {atRiskTotal}
          </p>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            {belowCount} below target • {borderlineCount} borderline
          </p>
        </div>

        {/* Metric 3: Recovery Requirements */}
        <div className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Recovery Deficit
            </span>
            <TrendingUp className="h-3.5 w-3.5 text-[var(--status-success)]" />
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--text-main)]">
            {totalRecoveryDeficit > 0 ? `${totalRecoveryDeficit}u` : '0u'}
          </p>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            {totalRecoveryDeficit > 0
              ? 'Consecutive units to hit minimums'
              : 'All subjects meeting threshold'}
          </p>
        </div>

        {/* Metric 4: Current Overall & Safe Margin */}
        <div className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Current Overall
            </span>
            <ShieldCheck className="h-3.5 w-3.5 text-[var(--primary)]" />
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--text-main)]">
            {formatPercentage(report?.overall.percentage ?? null)}
          </p>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            {safeBunksRemaining} safe immediate skip(s) left
          </p>
        </div>
      </div>

      {/* 1. Historical vs Predicted Attendance Trajectory */}
      <Card>
        <CardHeader className="pb-3.5">
          <div>
            <CardTitle>Historical &amp; Predicted Attendance Trajectory</CardTitle>
            <CardDescription>
              Solid line represents confirmed historical attendance; dashed lines show future projections under 100% and 80% attendance
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="primary" dot>
              Historical (Actual)
            </Badge>
            <Badge variant="success" dot>
              Predicted (100%)
            </Badge>
            <Badge variant="warning" dot>
              Predicted (80%)
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {trajectorySeries.length === 0 ? (
            <div className="flex h-72 items-center justify-center rounded-[10px] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-well)] text-xs text-[var(--text-secondary)]">
              Add timetable slots or attendance records to visualize your historical and predicted trajectory.
            </div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={trajectorySeries}
                  margin={{ top: 12, right: 16, left: -12, bottom: 0 }}
                >
                  <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: tickFill, fontSize: 11 }}
                    axisLine={{ stroke: gridStroke }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: tickFill, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: tooltipBg,
                      borderRadius: '12px',
                      border: `1px solid ${tooltipBorder}`,
                      color: textColor,
                      boxShadow: '0 12px 28px rgba(0, 0, 0, 0.12)',
                      fontSize: '12px',
                    }}
                    itemStyle={{ color: textColor }}
                    labelStyle={{ color: tickFill, marginBottom: '4px' }}
                    formatter={(val, name) => [
                      typeof val === 'number' ? `${val.toFixed(1)}%` : String(val ?? ''),
                      String(name),
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', color: tickFill }} />
                  <ReferenceLine
                    y={thresholdPercent}
                    stroke={warningColor}
                    strokeDasharray="4 4"
                    label={{
                      value: `Min ${thresholdPercent}%`,
                      position: 'insideTopRight',
                      fill: warningColor,
                      fontSize: 11,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="historicalPct"
                    name="Historical (Actual)"
                    stroke={primaryColor}
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: primaryColor }}
                    activeDot={{ r: 6, fill: primaryColor, stroke: tooltipBg, strokeWidth: 2 }}
                    animationDuration={350}
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="predictedAttendAllPct"
                    name="Predicted (Attend 100%)"
                    stroke={successColor}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 3, fill: successColor }}
                    activeDot={{ r: 5.5, fill: successColor, stroke: tooltipBg, strokeWidth: 2 }}
                    animationDuration={350}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="predictedAt80Pct"
                    name="Predicted (Attend 80%)"
                    stroke={warningColor}
                    strokeWidth={2}
                    strokeDasharray="3 3"
                    dot={{ r: 2.5, fill: warningColor }}
                    activeDot={{ r: 5, fill: warningColor, stroke: tooltipBg, strokeWidth: 2 }}
                    animationDuration={350}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Subject Comparisons + Historical Breakdown (2 Columns) */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-3.5">
            <div>
              <CardTitle>Subject Comparisons: Current vs. Projected</CardTitle>
              <CardDescription>
                Current subject percentage alongside projected semester-end if attending 100% of remaining classes
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {subjectComparison.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)]">No subjects configured yet.</p>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={subjectComparison}
                    margin={{ top: 10, right: 12, left: -16, bottom: 0 }}
                  >
                    <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="code"
                      tick={{ fill: tickFill, fontSize: 11 }}
                      axisLine={{ stroke: gridStroke }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fill: tickFill, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(109, 59, 110, 0.08)' }}
                      contentStyle={{
                        backgroundColor: tooltipBg,
                        borderRadius: '12px',
                        border: `1px solid ${tooltipBorder}`,
                        color: textColor,
                        boxShadow: '0 12px 28px rgba(0, 0, 0, 0.12)',
                        fontSize: '12px',
                      }}
                      itemStyle={{ color: textColor }}
                      labelStyle={{ color: tickFill, marginBottom: '4px' }}
                      formatter={(val, name) => [`${val ?? 0}%`, String(name)]}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', color: tickFill }} />
                    <ReferenceLine
                      y={thresholdPercent}
                      stroke={warningColor}
                      strokeDasharray="4 4"
                    />
                    <Bar
                      dataKey="currentPct"
                      name="Current %"
                      fill={primaryColor}
                      radius={[6, 6, 0, 0]}
                    />
                    <Bar
                      dataKey="projectedPct"
                      name="Projected (Attend All) %"
                      fill={successColor}
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3.5">
            <div>
              <CardTitle>Historical Attendance Unit Breakdown</CardTitle>
              <CardDescription>
                Attended vs. missed units vs. cancelled lectures (excluded from conducted totals)
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {subjectComparison.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)]">No subjects configured yet.</p>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={subjectComparison}
                    margin={{ top: 10, right: 12, left: -16, bottom: 0 }}
                  >
                    <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="code"
                      tick={{ fill: tickFill, fontSize: 11 }}
                      axisLine={{ stroke: gridStroke }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: tickFill, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(109, 59, 110, 0.08)' }}
                      contentStyle={{
                        backgroundColor: tooltipBg,
                        borderRadius: '12px',
                        border: `1px solid ${tooltipBorder}`,
                        color: textColor,
                        boxShadow: '0 12px 28px rgba(0, 0, 0, 0.12)',
                        fontSize: '12px',
                      }}
                      itemStyle={{ color: textColor }}
                      labelStyle={{ color: tickFill, marginBottom: '4px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', color: tickFill }} />
                    <Bar
                      dataKey="attended"
                      name="Attended"
                      stackId="a"
                      fill={successColor}
                    />
                    <Bar
                      dataKey="missed"
                      name="Missed / Mass Bunk"
                      stackId="a"
                      fill={dangerColor}
                    />
                    <Bar
                      dataKey="cancelledExcluded"
                      name="Cancelled (Excluded)"
                      stackId="a"
                      fill={neutralColor}
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 3. Recovery Projection Curve + Margin Summary */}
      <Card>
        <CardHeader className="flex-col pb-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Recovery Projections</CardTitle>
            <CardDescription>
              Consecutive attended classes required to cross the {thresholdPercent}% threshold
            </CardDescription>
          </div>
          {subjects.length > 0 && (
            <div className="w-full sm:w-64">
              <Select
                value={activeRecoveryId}
                onChange={(e) => setRecoverySubjectId(e.target.value)}
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </Select>
            </div>
          )}
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            {recoveryCurve.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)]">Select a subject to inspect recovery curve.</p>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={recoveryCurve}
                    margin={{ top: 10, right: 12, left: -16, bottom: 0 }}
                  >
                    <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: tickFill, fontSize: 11 }}
                      axisLine={{ stroke: gridStroke }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fill: tickFill, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: tooltipBg,
                        borderRadius: '12px',
                        border: `1px solid ${tooltipBorder}`,
                        color: textColor,
                        boxShadow: '0 12px 28px rgba(0, 0, 0, 0.12)',
                        fontSize: '12px',
                      }}
                      itemStyle={{ color: textColor }}
                      labelStyle={{ color: tickFill, marginBottom: '4px' }}
                      formatter={(v) => [`${v ?? 0}%`, 'Projected %']}
                    />
                    <ReferenceLine
                      y={thresholdPercent}
                      stroke={warningColor}
                      strokeDasharray="4 4"
                      label={{
                        value: `Target ${thresholdPercent}%`,
                        position: 'insideTopRight',
                        fill: warningColor,
                        fontSize: 11,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="projectedPct"
                      stroke={primaryColor}
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: primaryColor }}
                      activeDot={{ r: 6, fill: primaryColor, stroke: tooltipBg, strokeWidth: 2 }}
                      animationDuration={350}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="space-y-3 lg:col-span-5">
            <div className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              <TrendingUp className="h-3.5 w-3.5 text-[var(--primary)]" />
              <span>Subject Recovery &amp; Margin Summary</span>
            </div>
            <div className="space-y-2">
              {report?.subjectSummaries.map((item) => {
                const isSelected = item.subject.id === activeRecoveryId;
                return (
                  <button
                    key={item.subject.id}
                    type="button"
                    onClick={() => setRecoverySubjectId(item.subject.id)}
                    aria-pressed={isSelected}
                    className={`flex w-full items-center justify-between gap-2 rounded-[10px] border px-3 py-2.5 text-left text-xs transition-all duration-150 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50 ${
                      isSelected
                        ? 'border-[var(--primary)] bg-[var(--primary)]/10 font-semibold shadow-xs'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-surface-well)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: item.subject.color }}
                        />
                        <p className="truncate font-semibold text-[var(--text-main)]">
                          {item.subject.name} ({item.subject.code})
                        </p>
                      </div>
                      <p className="mt-0.5 font-mono text-[11px] tabular-nums text-[var(--text-secondary)]">
                        Current: {formatPercentage(item.percentage)} • Max: {formatPercentage(item.projectedIfAttendAllPercentage)}
                      </p>
                    </div>

                    <div className="shrink-0">
                      {item.status === 'danger' ? (
                        <Badge variant="danger">
                          Need +{item.recoveryClassesNeeded ?? '∞'}u
                        </Badge>
                      ) : item.status === 'no_data' ? (
                        <Badge variant="neutral">N/A</Badge>
                      ) : (
                        <Badge variant="success">
                          {item.immediateSafeBunks} safe skips
                        </Badge>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

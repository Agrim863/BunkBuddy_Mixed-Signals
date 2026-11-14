import type { SemesterAttendanceReport, SubjectAttendanceSummary } from './attendanceAggregator';
import { calculateFuturePercentage, calculatePercentage } from './attendanceMath';
import { buildHistoricalTrendPoints } from './trendBuilder';
import type { AttendanceRecord, Semester, Subject } from '../types/domain';

export interface TrajectoryPoint {
  date: string;
  label: string;
  phase: 'historical' | 'predicted';
  historicalPct: number | null;
  predictedAttendAllPct: number | null;
  predictedAt80Pct: number | null;
  thresholdPct: number;
  note: string;
}

export interface SubjectComparisonPoint {
  code: string;
  name: string;
  color: string;
  currentPct: number;
  projectedPct: number;
  hasData: boolean;
  attended: number;
  conducted: number;
  missed: number;
  cancelledExcluded: number;
  thresholdPct: number;
}

export interface RecoveryCurvePoint {
  consecutiveClass: number;
  label: string;
  projectedPct: number;
  thresholdPct: number;
}

/**
 * Builds a unified timeline clearly distinguishing Historical (actual recorded progression)
 * from Predicted (future scheduled sessions from asOfDate to semester end).
 */
export function buildCombinedTrajectorySeries(params: {
  semester: Semester;
  subjects: Subject[];
  attendanceRecords: AttendanceRecord[];
  report: SemesterAttendanceReport;
}): TrajectoryPoint[] {
  const { semester, subjects, attendanceRecords, report } = params;
  const thresholdPct = Number((semester.minimumAttendance * 100).toFixed(1));

  const historicalPoints = buildHistoricalTrendPoints({
    semester,
    subjects,
    attendanceRecords,
  });

  const series: TrajectoryPoint[] = historicalPoints.map((pt) => ({
    date: pt.date,
    label: pt.label,
    phase: 'historical',
    historicalPct: pt.overallPercentage,
    predictedAttendAllPct: null,
    predictedAt80Pct: null,
    thresholdPct,
    note: `${pt.attendedCumulative}/${pt.conductedCumulative} conducted`,
  }));

  // Anchor prediction from current overall totals on report.asOfDate so curves connect cleanly
  const currentA = report.overall.attended;
  const currentC = report.overall.conducted;
  const currentPct = calculatePercentage(currentA, currentC);

  if (currentPct !== null) {
    const anchorRounded = Number(currentPct.toFixed(2));
    const lastHist = series[series.length - 1];
    if (lastHist && lastHist.date === report.asOfDate) {
      lastHist.predictedAttendAllPct = anchorRounded;
      lastHist.predictedAt80Pct = anchorRounded;
    } else {
      series.push({
        date: report.asOfDate,
        label: 'Today',
        phase: 'historical',
        historicalPct: anchorRounded,
        predictedAttendAllPct: anchorRounded,
        predictedAt80Pct: anchorRounded,
        thresholdPct,
        note: `${currentA}/${currentC} current`,
      });
    }
  }

  // Group future predicted sessions chronologically by week or date chunks
  const upcomingByDate = new Map<string, number>();
  for (const session of report.upcomingSessions) {
    upcomingByDate.set(
      session.date,
      (upcomingByDate.get(session.date) ?? 0) + session.attendanceUnits,
    );
  }

  const futureDates = [...upcomingByDate.keys()].sort();
  if (futureDates.length === 0) {
    return series;
  }

  // Sample weekly checkpoints (every 7th active date + final date) to keep chart readable across long semesters
  let cumulativeFutureConducted = 0;
  const step = Math.max(1, Math.ceil(futureDates.length / 8));

  for (let i = 0; i < futureDates.length; i++) {
    const date = futureDates[i]!;
    cumulativeFutureConducted += upcomingByDate.get(date) ?? 0;

    const isCheckpoint = i === futureDates.length - 1 || (i + 1) % step === 0;
    if (!isCheckpoint) continue;

    const pctAll = calculateFuturePercentage(
      currentA,
      currentC,
      cumulativeFutureConducted,
      cumulativeFutureConducted,
    );
    const att80 = Math.round(cumulativeFutureConducted * 0.8);
    const pct80 = calculateFuturePercentage(
      currentA,
      currentC,
      att80,
      cumulativeFutureConducted,
    );

    series.push({
      date,
      label: `${date.slice(5)} (Pred)`,
      phase: 'predicted',
      historicalPct: null,
      predictedAttendAllPct: pctAll !== null ? Number(pctAll.toFixed(2)) : null,
      predictedAt80Pct: pct80 !== null ? Number(pct80.toFixed(2)) : null,
      thresholdPct,
      note: `+${cumulativeFutureConducted} predicted unit(s)`,
    });
  }

  return series;
}

/**
 * Builds per-subject comparison data for Recharts bar charts.
 */
export function buildSubjectComparisonData(
  report: SemesterAttendanceReport,
): SubjectComparisonPoint[] {
  const thresholdPct = Number((report.semester.minimumAttendance * 100).toFixed(1));

  return report.subjectSummaries.map((item) => ({
    code: item.subject.code,
    name: item.subject.name,
    color: item.subject.color,
    currentPct:
      item.percentage !== null ? Number(item.percentage.toFixed(1)) : 0,
    projectedPct:
      item.projectedIfAttendAllPercentage !== null
        ? Number(item.projectedIfAttendAllPercentage.toFixed(1))
        : 0,
    hasData: item.conducted > 0,
    attended: item.attended,
    conducted: item.conducted,
    missed: item.missed,
    cancelledExcluded: item.trackedCancelledUnits,
    thresholdPct,
  }));
}

/**
 * Plots consecutive class-by-class attendance recovery curve for a subject (or overall)
 * showing exactly when it crosses the minimum attendance threshold.
 */
export function buildRecoveryCurveSeries(
  summary: Pick<SubjectAttendanceSummary, 'attended' | 'conducted'>,
  minimumThreshold: number,
  recoveryClassesNeeded: number | null,
): RecoveryCurvePoint[] {
  const thresholdPct = Number((minimumThreshold * 100).toFixed(1));
  const horizon = Math.min(
    25,
    Math.max(8, (recoveryClassesNeeded ?? 0) + 3),
  );

  const points: RecoveryCurvePoint[] = [];
  for (let step = 0; step <= horizon; step++) {
    const pct = calculateFuturePercentage(
      summary.attended,
      summary.conducted,
      step,
      step,
    );
    if (pct === null && step === 0) {
      points.push({
        consecutiveClass: 0,
        label: 'Now',
        projectedPct: 0,
        thresholdPct,
      });
      continue;
    }
    points.push({
      consecutiveClass: step,
      label: step === 0 ? 'Now' : `+${step}`,
      projectedPct: pct !== null ? Number(pct.toFixed(2)) : 0,
      thresholdPct,
    });
  }

  return points;
}

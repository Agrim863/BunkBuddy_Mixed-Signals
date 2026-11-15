import { getAttendanceRecordContribution } from './attendanceAggregator';
import { calculatePercentage } from './attendanceMath';
import type { AttendanceRecord, Semester, Subject } from '../types/domain';

export interface AttendanceTrendPoint {
  date: string;
  label: string;
  overallPercentage: number;
  attendedCumulative: number;
  conductedCumulative: number;
  thresholdPercentage: number;
}

/**
 * Builds chronological cumulative overall attendance trend points from historical baseline + tracked records.
 * Historical baseline sits at trackingStartDate (or startDate for fresh mode) before subsequent tracked dates.
 */
export function buildHistoricalTrendPoints(params: {
  semester: Semester;
  subjects: Subject[];
  attendanceRecords: AttendanceRecord[];
}): AttendanceTrendPoint[] {
  const { semester, subjects, attendanceRecords } = params;
  const thresholdPercentage = Number((semester.minimumAttendance * 100).toFixed(1));

  let runningAttended =
    semester.mode === 'fresh'
      ? 0
      : subjects.reduce((sum, s) => sum + Math.max(0, s.historicalAttended), 0);
  let runningConducted =
    semester.mode === 'fresh'
      ? 0
      : subjects.reduce((sum, s) => sum + Math.max(0, s.historicalConducted), 0);

  const trackedByDate = new Map<string, AttendanceRecord[]>();
  for (const rec of attendanceRecords) {
    if (rec.source !== 'tracked') continue;
    if (rec.date < semester.trackingStartDate) continue;
    const list = trackedByDate.get(rec.date) ?? [];
    list.push(rec);
    trackedByDate.set(rec.date, list);
  }

  const points: AttendanceTrendPoint[] = [];

  if (runningConducted > 0) {
    const pct = calculatePercentage(runningAttended, runningConducted) ?? 0;
    points.push({
      date: semester.trackingStartDate,
      label: 'Baseline',
      overallPercentage: Number(pct.toFixed(2)),
      attendedCumulative: runningAttended,
      conductedCumulative: runningConducted,
      thresholdPercentage,
    });
  }

  const sortedDates = [...trackedByDate.keys()].sort();
  for (const date of sortedDates) {
    const dayRecords = trackedByDate.get(date)!;
    for (const rec of dayRecords) {
      const contrib = getAttendanceRecordContribution(rec);
      runningAttended += contrib.attendedDelta;
      runningConducted += contrib.conductedDelta;
    }

    if (runningConducted > 0) {
      const pct = calculatePercentage(runningAttended, runningConducted) ?? 0;
      points.push({
        date,
        label: date.slice(5), // MM-DD
        overallPercentage: Number(pct.toFixed(2)),
        attendedCumulative: runningAttended,
        conductedCumulative: runningConducted,
        thresholdPercentage,
      });
    }
  }

  return points;
}

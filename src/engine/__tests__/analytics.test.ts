import { describe, expect, it } from 'vitest';
import { buildDemoDataset } from '../../data/demoSemester';
import {
  buildCombinedTrajectorySeries,
  buildRecoveryCurveSeries,
  buildSubjectComparisonData,
  computeSemesterAttendanceReport,
} from '../index';

describe('Analytics Engine', () => {
  const refDate = new Date('2026-11-10T09:00:00Z');
  const demo = buildDemoDataset(refDate);
  const report = computeSemesterAttendanceReport({
    semester: demo.semester,
    subjects: demo.subjects,
    timetableEntries: demo.timetableEntries,
    calendarEvents: demo.calendarEvents,
    attendanceRecords: demo.attendanceRecords,
    asOfDate: '2026-11-10',
  });

  it('clearly separates historical and predicted phases in combined trajectory', () => {
    const series = buildCombinedTrajectorySeries({
      semester: demo.semester,
      subjects: demo.subjects,
      attendanceRecords: demo.attendanceRecords,
      report,
    });

    const historical = series.filter((p) => p.phase === 'historical');
    const predicted = series.filter((p) => p.phase === 'predicted');

    expect(historical.length).toBeGreaterThan(0);
    expect(predicted.length).toBeGreaterThan(0);

    // Purely predicted points must NOT populate historicalPct
    for (const p of predicted) {
      expect(p.historicalPct).toBeNull();
      expect(p.predictedAttendAllPct).not.toBeNull();
    }
  });

  it('builds per-subject comparison data including excluded cancelled units', () => {
    const comparison = buildSubjectComparisonData(report);
    expect(comparison).toHaveLength(5);

    const os = comparison.find((c) => c.code === 'CS302')!;
    expect(os.cancelledExcluded).toBe(1);
    expect(os.projectedPct).toBeGreaterThanOrEqual(os.currentPct);
  });

  it('plots consecutive recovery curve crossing threshold at exact recovery count', () => {
    // 11 / 18 = 61.1% -> needs 10 consecutive classes at 75%: (11+10)/(18+10) = 21/28 = 75%
    const curve = buildRecoveryCurveSeries({ attended: 11, conducted: 18 }, 0.75, 10);
    expect(curve[0]?.projectedPct).toBeLessThan(75);
    expect(curve[9]?.projectedPct).toBeLessThan(75);
    expect(curve[10]?.projectedPct).toBe(75);
  });
});

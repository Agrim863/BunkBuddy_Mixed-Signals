import { describe, expect, it } from 'vitest';
import { buildDemoDataset } from '../../data/demoSemester';
import {
  computeSemesterAttendanceReport,
  getSessionKey,
  simulateBunkScenario,
  simulateMassBunkDate,
} from '../index';

describe('Bunk Simulator & Mass Bunk Engines', () => {
  const refDate = new Date('2026-11-10T09:00:00Z'); // Tuesday
  const demo = buildDemoDataset(refDate);

  const report = computeSemesterAttendanceReport({
    semester: demo.semester,
    subjects: demo.subjects,
    timetableEntries: demo.timetableEntries,
    calendarEvents: demo.calendarEvents,
    attendanceRecords: demo.attendanceRecords,
    asOfDate: '2026-11-10',
  });

  it('computes Scenario A/B/C comparisons without mutating actual attendance records', () => {
    const beforeSnapshot = JSON.stringify(demo.attendanceRecords);
    const dsa = demo.subjects[0]!; // CS301

    const dsaUpcoming = report.upcomingSessions.filter(
      (s) => s.subjectId === dsa.id,
    );
    expect(dsaUpcoming.length).toBeGreaterThanOrEqual(2);

    const pickedKeys = dsaUpcoming.slice(0, 2).map(getSessionKey);
    const singleDay = dsaUpcoming[0]!.date;

    const sim = simulateBunkScenario({
      report,
      focusSubjectId: dsa.id,
      singleDate: singleDay,
      selectedSessionKeys: pickedKeys,
      extraMissedUnits: 1,
      otherUpcomingAttendRate: 1,
      horizon: 'next_30_days',
    });

    // Scenario A (attend all) must end higher than Scenario B and Scenario C
    expect(sim.scenarios.A.simulatedPercentage!).toBeGreaterThan(
      sim.scenarios.B.simulatedPercentage!,
    );
    expect(sim.scenarios.B.simulatedPercentage!).toBeGreaterThanOrEqual(
      sim.scenarios.C.simulatedPercentage!,
    );
    expect(sim.scenarios.C.missedUnitsInScenario).toBeGreaterThanOrEqual(3);

    // Overall impact is computed independently from single subject scope
    expect(sim.overall.conducted).not.toBe(sim.primary.conducted);

    // Persisted records remain completely untouched
    expect(JSON.stringify(demo.attendanceRecords)).toBe(beforeSnapshot);
  });

  it('evaluates mass bunk as conducted absences (never as a holiday) across multiple subjects', () => {
    const targetMonday = '2026-11-16';
    const mondayEntries = demo.timetableEntries.filter((t) => t.weekday === 1);
    expect(mondayEntries).toHaveLength(3);

    const res = simulateMassBunkDate({
      report,
      dateIso: targetMonday,
      timetableEntries: demo.timetableEntries,
      calendarEvents: demo.calendarEvents,
      attendanceRecords: demo.attendanceRecords,
      selectedTimetableEntryIds: mondayEntries.map((t) => t.id),
    });

    expect(res.blockingCalendarEvent).toBeNull();
    expect(res.subjectImpacts).toHaveLength(3);
    expect(res.consolidatedImpact.totalMissedUnits).toBe(4);
    expect(res.consolidatedImpact.afterAttended).toBe(report.overall.attended);
    expect(res.consolidatedImpact.afterConducted).toBe(
      report.overall.conducted + 4,
    );
    expect(res.consolidatedImpact.percentagePointDelta!).toBeLessThan(0);
  });

  it('surfaces blocking calendar event when mass bunk date falls on an official holiday', () => {
    const holidayDate = demo.calendarEvents[0]!.date;
    const res = simulateMassBunkDate({
      report,
      dateIso: holidayDate,
      timetableEntries: demo.timetableEntries,
      calendarEvents: demo.calendarEvents,
      attendanceRecords: demo.attendanceRecords,
      selectedTimetableEntryIds: [],
    });

    expect(res.blockingCalendarEvent).not.toBeNull();
    expect(res.blockingCalendarEvent?.title).toBe('Founder’s Day Holiday');
  });
});

import { describe, expect, it } from 'vitest';
import {
  calculateFuturePercentage,
  calculateImmediateSafeBunks,
  calculatePercentage,
  calculatePercentagePointDelta,
  calculateRecoveryClasses,
  calculateSemesterAbsenceBudget,
  classifyAttendanceStatus,
  computeSemesterAttendanceReport,
  formatPercentage,
  formatPercentagePointDelta,
  generateScheduledSessions,
  hasDuplicateAttendanceRecord,
  normalizeHistoricalBaselines,
  validateHistoricalInitialization,
} from '../index';
import type {
  AttendanceRecord,
  CalendarEvent,
  Semester,
  Subject,
  TimetableEntry,
} from '../../types/domain';

const baseSemester: Semester = {
  id: 'sem-1',
  userId: 'user-1',
  name: 'Semester 5',
  mode: 'ongoing',
  startDate: '2026-10-01',
  endDate: '2026-10-18',
  trackingStartDate: '2026-10-12', // Monday
  minimumAttendance: 0.75,
  isActive: true,
  createdAt: '2026-10-01T00:00:00.000Z',
};

const subjectAlgorithms: Subject = {
  id: 'sub-algo',
  semesterId: 'sem-1',
  name: 'Algorithms',
  code: 'CS301',
  color: '#6366F1',
  historicalConducted: 20,
  historicalAttended: 14, // 70% (below 75%)
  createdAt: '2026-10-01T00:00:00.000Z',
};

const subjectDbmsLab: Subject = {
  id: 'sub-dbms',
  semesterId: 'sem-1',
  name: 'DBMS Lab',
  code: 'CS302',
  color: '#10B981',
  historicalConducted: 10,
  historicalAttended: 10, // 100%
  createdAt: '2026-10-01T00:00:00.000Z',
};

describe('Attendance Calculation Math', () => {
  it('handles C = 0 safely as null / N/A', () => {
    expect(calculatePercentage(0, 0)).toBeNull();
    expect(formatPercentage(null)).toBe('N/A');
    expect(calculateFuturePercentage(0, 0, 0, 0)).toBeNull();
    expect(calculateRecoveryClasses(0, 0, 0.75)).toBe(0);
    expect(calculateImmediateSafeBunks(0, 0, 0.75)).toBe(0);
  });

  it('computes P and P_future accurately', () => {
    expect(calculatePercentage(15, 20)).toBe(75);
    expect(formatPercentage(calculatePercentage(15, 20))).toBe('75.0%');

    // (14 + 4) / (20 + 4) = 18 / 24 = 75%
    expect(calculateFuturePercentage(14, 20, 4, 4)).toBe(75);
    // (14 + 0) / (20 + 5) = 14 / 25 = 56%
    expect(calculateFuturePercentage(14, 20, 0, 5)).toBe(56);
  });

  it('calculates minimum consecutive recovery classes accurately with floating-point safety', () => {
    // A = 7, C = 10, M = 0.75 => ceil((7.5 - 7) / 0.25) = 2 -> 9/12 = 75%
    expect(calculateRecoveryClasses(7, 10, 0.75)).toBe(2);
    // A = 6, C = 10, M = 0.75 => ceil(1.5 / 0.25) = 6 -> 12/16 = 75%
    expect(calculateRecoveryClasses(6, 10, 0.75)).toBe(6);
    // A = 8, C = 11, M = 0.75 => ceil(0.25 / 0.25) = 1 -> 9/12 = 75%
    expect(calculateRecoveryClasses(8, 11, 0.75)).toBe(1);
    // Exact boundary 75.00% or 80.00% returns 0
    expect(calculateRecoveryClasses(15, 20, 0.75)).toBe(0);
    expect(calculateRecoveryClasses(17, 20, 0.85)).toBe(0);
    // Above threshold returns 0
    expect(calculateRecoveryClasses(18, 20, 0.75)).toBe(0);
    // Unreachable 100% threshold when already missed
    expect(calculateRecoveryClasses(9, 10, 1)).toBeNull();
  });

  it('calculates immediate safe bunks and full-semester absence budget', () => {
    // 10 / 10 at 75%: skip 3 -> 10/13 = 76.92% >= 75%, skip 4 -> 10/14 = 71.43% < 75%
    expect(calculateImmediateSafeBunks(10, 10, 0.75)).toBe(3);
    // Exact threshold -> 0 immediate safe bunks
    expect(calculateImmediateSafeBunks(15, 20, 0.75)).toBe(0);
    // Below threshold -> 0 immediate safe bunks
    expect(calculateImmediateSafeBunks(14, 20, 0.75)).toBe(0);

    // Remaining semester budget: A=15, C=20, F=20, M=0.75 -> totalC=40, minA=30, maxA=35 => 5
    expect(calculateSemesterAbsenceBudget(15, 20, 20, 0.75)).toBe(5);
    // If below recovery even after attending all remaining -> 0 budget
    expect(calculateSemesterAbsenceBudget(5, 20, 5, 0.75)).toBe(0);
  });

  it('computes percentage-point differences and health classifications', () => {
    const delta = calculatePercentagePointDelta(75, 72.5);
    expect(delta).toBe(-2.5);
    expect(formatPercentagePointDelta(delta)).toBe('-2.50 pp');

    expect(classifyAttendanceStatus(null, 0.75)).toBe('no_data');
    expect(classifyAttendanceStatus(74.9, 0.75)).toBe('danger');
    expect(classifyAttendanceStatus(75, 0.75)).toBe('borderline');
    expect(classifyAttendanceStatus(79.9, 0.75)).toBe('borderline');
    expect(classifyAttendanceStatus(80, 0.75)).toBe('safe');
  });
});

describe('Schedule Expansion & Business Rules', () => {
  const timetable: TimetableEntry[] = [
    // Monday morning + afternoon (multiple lectures per day)
    {
      id: 'tt-mon-1',
      semesterId: 'sem-1',
      subjectId: 'sub-algo',
      weekday: 1, // Monday
      startTime: '09:00',
      endTime: '10:00',
      teachingDurationMinutes: 60,
      attendanceUnits: 1,
      sessionType: 'lecture',
    },
    {
      id: 'tt-mon-2',
      semesterId: 'sem-1',
      subjectId: 'sub-algo',
      weekday: 1, // Monday
      startTime: '11:00',
      endTime: '12:00',
      teachingDurationMinutes: 60,
      attendanceUnits: 1,
      sessionType: 'tutorial',
    },
    // Wednesday 2-hour lab counting as 2 attendance units
    {
      id: 'tt-wed-lab',
      semesterId: 'sem-1',
      subjectId: 'sub-dbms',
      weekday: 3, // Wednesday
      startTime: '14:00',
      endTime: '16:00',
      teachingDurationMinutes: 120,
      attendanceUnits: 2,
      sessionType: 'lab',
    },
  ];

  const calendarEvents: CalendarEvent[] = [
    {
      id: 'ev-hol',
      semesterId: 'sem-1',
      date: '2026-10-14', // Wednesday
      eventType: 'official_holiday',
      title: 'Midterm Holiday',
      affectsClasses: true,
    },
  ];

  it('excludes holidays, respects attendance units, and prevents double-counting tracked slots', () => {
    const records: AttendanceRecord[] = [
      // Confirmed Monday first lecture (2026-10-12) as present
      {
        id: 'rec-1',
        semesterId: 'sem-1',
        subjectId: 'sub-algo',
        timetableEntryId: 'tt-mon-1',
        date: '2026-10-12',
        status: 'present',
        attendanceUnits: 1,
        source: 'tracked',
      },
      // Confirmed Monday second lecture (2026-10-12) as mass_bunk -> counts as conducted absence!
      {
        id: 'rec-2',
        semesterId: 'sem-1',
        subjectId: 'sub-algo',
        timetableEntryId: 'tt-mon-2',
        date: '2026-10-12',
        status: 'mass_bunk',
        attendanceUnits: 1,
        source: 'tracked',
      },
      // Historical log before trackingStartDate -> audit-only, NEVER double-counted!
      {
        id: 'rec-hist',
        semesterId: 'sem-1',
        subjectId: 'sub-algo',
        timetableEntryId: null,
        date: '2026-10-05',
        status: 'absent',
        attendanceUnits: 1,
        source: 'historical_log',
      },
      // Cancelled lecture -> must NOT increase conducted
      {
        id: 'rec-cancel',
        semesterId: 'sem-1',
        subjectId: 'sub-dbms',
        timetableEntryId: null,
        date: '2026-10-13',
        status: 'cancelled',
        attendanceUnits: 2,
        source: 'tracked',
      },
    ];

    const sessions = generateScheduledSessions({
      semester: baseSemester,
      timetableEntries: timetable,
      calendarEvents,
      attendanceRecords: records,
      fromDate: '2026-10-01', // Should clamp up to trackingStartDate 2026-10-12
      toDate: '2026-10-18',
    });

    // Week Oct 12..Oct 18 has Mon Oct 12 (2 slots), Wed Oct 14 (1 holiday slot)
    expect(sessions).toHaveLength(3);
    // Oct 12 slots already recorded -> not counted as future predictions
    expect(sessions[0]?.isCountedAsFuturePrediction).toBe(false);
    expect(sessions[1]?.isCountedAsFuturePrediction).toBe(false);
    // Oct 14 blocked by official holiday -> not counted as future prediction
    expect(sessions[2]?.blockedByEvent?.title).toBe('Midterm Holiday');
    expect(sessions[2]?.isCountedAsFuturePrediction).toBe(false);

    const report = computeSemesterAttendanceReport({
      semester: baseSemester,
      subjects: [subjectAlgorithms, subjectDbmsLab],
      timetableEntries: timetable,
      calendarEvents,
      attendanceRecords: records,
      asOfDate: '2026-10-13',
    });

    const algo = report.subjectSummaries.find((s) => s.subject.id === 'sub-algo')!;
    const dbms = report.subjectSummaries.find((s) => s.subject.id === 'sub-dbms')!;

    // Algorithms: historical 14/20 + tracked present (1/1) + mass_bunk (0/1) = 15/22
    expect(algo.conducted).toBe(22);
    expect(algo.attended).toBe(15);
    expect(algo.trackedMassBunkUnits).toBe(1);
    expect(algo.percentage).toBeCloseTo((15 / 22) * 100, 4);
    // Recovery needed for 15/22 at 75%: ceil((0.75*22 - 15)/0.25) = ceil(1.5/0.25) = 6
    expect(algo.recoveryClassesNeeded).toBe(6);

    // DBMS Lab: historical 10/10 + cancelled(2) => still 10/10!
    expect(dbms.conducted).toBe(10);
    expect(dbms.attended).toBe(10);
    expect(dbms.trackedCancelledUnits).toBe(2);
    expect(dbms.percentage).toBe(100);

    // Overall: (15 + 10) / (22 + 10) = 25 / 32 = 78.125% (SAFE overall, yet algo is DANGER!)
    expect(report.overall.attended).toBe(25);
    expect(report.overall.conducted).toBe(32);
    expect(report.overall.percentage).toBeCloseTo(78.125, 4);
    expect(report.overall.subjectsBelowThreshold.map((s) => s.subject.code)).toEqual([
      'CS301',
    ]);
  });

  it('fresh semester ignores any non-zero historical values and tracks from startDate', () => {
    const freshSemester: Semester = {
      ...baseSemester,
      mode: 'fresh',
      trackingStartDate: '2026-10-12',
    };

    const normalized = normalizeHistoricalBaselines(
      'fresh',
      [subjectAlgorithms],
      [{ subjectId: 'sub-algo', conducted: 20, attended: 14 }],
    );
    expect(normalized[0]?.historicalConducted).toBe(0);
    expect(normalized[0]?.historicalAttended).toBe(0);

    const report = computeSemesterAttendanceReport({
      semester: freshSemester,
      subjects: [subjectAlgorithms], // even if raw object had values, engine treats fresh as 0/0
      timetableEntries: timetable.slice(0, 1),
      calendarEvents: [],
      attendanceRecords: [],
      asOfDate: '2026-10-12',
    });

    // Future classes do NOT increment current conducted/attended until confirmed
    expect(report.overall.conducted).toBe(0);
    expect(report.overall.attended).toBe(0);
    expect(report.overall.percentage).toBeNull();
    expect(report.overall.remainingScheduledUnits).toBe(1);
  });
});

describe('Historical Initialization & Duplicate Guard', () => {
  it('validates historical initialization boundaries and detects duplicates', () => {
    const invalidRes = validateHistoricalInitialization(
      baseSemester,
      [subjectAlgorithms],
      [
        {
          id: 'bad-log',
          semesterId: 'sem-1',
          subjectId: 'sub-algo',
          timetableEntryId: null,
          date: '2026-10-13', // >= trackingStartDate 2026-10-12!
          status: 'present',
          attendanceUnits: 1,
          source: 'historical_log',
        },
      ],
    );
    expect(invalidRes.valid).toBe(false);
    expect(invalidRes.errors[0]).toContain('prevent double-counting');

    const existing: AttendanceRecord[] = [
      {
        id: 'rec-1',
        semesterId: 'sem-1',
        subjectId: 'sub-algo',
        timetableEntryId: 'tt-mon-1',
        date: '2026-10-12',
        status: 'present',
        attendanceUnits: 1,
        source: 'tracked',
      },
    ];

    expect(
      hasDuplicateAttendanceRecord(existing, {
        subjectId: 'sub-algo',
        date: '2026-10-12',
        timetableEntryId: 'tt-mon-1',
        source: 'tracked',
      }),
    ).toBe(true);

    expect(
      hasDuplicateAttendanceRecord(existing, {
        subjectId: 'sub-algo',
        date: '2026-10-12',
        timetableEntryId: 'tt-mon-2',
        source: 'tracked',
      }),
    ).toBe(false);
  });
});

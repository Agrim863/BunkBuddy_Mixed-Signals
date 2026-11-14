import { describe, expect, it } from 'vitest';
import { semesterSetupSchema } from './semester.schema';
import { subjectSchema } from './subject.schema';
import {
  computeDurationMinutes,
  timetableEntrySchema,
} from './timetable.schema';
import { calendarEventSchema } from './calendar.schema';
import { historicalInitializationSchema } from './attendance.schema';

describe('Zod validation schemas', () => {
  it('validates semester date range and configurable threshold', () => {
    const valid = semesterSetupSchema.safeParse({
      mode: 'ongoing',
      name: 'Semester 5',
      startDate: '2026-08-01',
      endDate: '2026-12-15',
      trackingStartDate: '2026-10-01',
      minimumAttendancePercent: 80,
    });
    expect(valid.success).toBe(true);

    const badDates = semesterSetupSchema.safeParse({
      mode: 'fresh',
      name: 'Sem 1',
      startDate: '2026-12-01',
      endDate: '2026-08-01',
      trackingStartDate: '2026-12-01',
      minimumAttendancePercent: 75,
    });
    expect(badDates.success).toBe(false);

    const badThreshold = semesterSetupSchema.safeParse({
      mode: 'fresh',
      name: 'Sem 1',
      startDate: '2026-08-01',
      endDate: '2026-12-01',
      trackingStartDate: '2026-08-01',
      minimumAttendancePercent: 100,
    });
    expect(badThreshold.success).toBe(false);
  });

  it('prevents attended exceeding conducted in subjects and historical init', () => {
    expect(
      subjectSchema.safeParse({
        name: 'Operating Systems',
        code: 'cs304',
        color: '#6366F1',
        historicalConducted: 18,
        historicalAttended: 20,
      }).success,
    ).toBe(false);

    const upper = subjectSchema.parse({
      name: 'Operating Systems',
      code: 'cs304',
      color: '#6366F1',
      historicalConducted: 20,
      historicalAttended: 16,
    });
    expect(upper.code).toBe('CS304');

    expect(
      historicalInitializationSchema.safeParse({
        trackingStartDate: '2026-10-15',
        subjectTotals: [{ subjectId: 's1', conducted: 10, attended: 12 }],
      }).success,
    ).toBe(false);
  });

  it('validates timetable slots with separate duration and attendance units', () => {
    const duration = computeDurationMinutes('14:00', '16:00');
    expect(duration).toBe(120);

    // 2-hour lab counting as 1 attendance entry
    const oneUnitLab = timetableEntrySchema.safeParse({
      subjectId: 'sub-1',
      weekday: 2,
      startTime: '14:00',
      endTime: '16:00',
      teachingDurationMinutes: 120,
      attendanceUnits: 1,
      sessionType: 'lab',
    });
    expect(oneUnitLab.success).toBe(true);

    // 2-hour lab counting as 2 separate periods
    const twoUnitLab = timetableEntrySchema.safeParse({
      subjectId: 'sub-1',
      weekday: 2,
      startTime: '14:00',
      endTime: '16:00',
      teachingDurationMinutes: 120,
      attendanceUnits: 2,
      sessionType: 'lab',
    });
    expect(twoUnitLab.success).toBe(true);

    expect(
      timetableEntrySchema.safeParse({
        subjectId: 'sub-1',
        weekday: 2,
        startTime: '16:00',
        endTime: '14:00',
        teachingDurationMinutes: 60,
        attendanceUnits: 1,
        sessionType: 'lecture',
      }).success,
    ).toBe(false);
  });

  it('validates calendar event date ordering', () => {
    expect(
      calendarEventSchema.safeParse({
        date: '2026-10-15',
        endDate: '2026-10-12',
        eventType: 'semester_break',
        title: 'Midterm Break',
        affectsClasses: true,
      }).success,
    ).toBe(false);
  });
});

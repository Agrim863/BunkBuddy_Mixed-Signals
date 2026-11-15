import { describe, expect, it } from 'vitest';
import { buildDemoDataset } from '../data/demoSemester';
import { computeSemesterAttendanceReport } from './attendanceAggregator';
import { simulateMassBunkDate } from './massBunkEngine';
import { calculatePercentage, calculateFuturePercentage } from './attendanceMath';

describe('phase 1 attendance safety', () => {
  it('never reports percentages above 100%', () => {
    expect(calculatePercentage(12, 10)).toBe(100);
    expect(calculateFuturePercentage(12, 10, 3, 2)).toBe(100);
  });
  it('does not double count an already logged timetable session', () => {
    const d = buildDemoDataset(new Date('2026-11-10T10:00:00Z'));
    const slot = d.timetableEntries[0]!;
    const dateIso = '2026-11-16';
    const records = [...d.attendanceRecords, { id: 'test-logged', semesterId: d.semester.id, subjectId: slot.subjectId, timetableEntryId: slot.id, date: dateIso, status: 'present' as const, attendanceUnits: slot.attendanceUnits, source: 'tracked' as const }];
    const report = computeSemesterAttendanceReport({ semester: d.semester, subjects: d.subjects, timetableEntries: d.timetableEntries, calendarEvents: [], attendanceRecords: records, asOfDate: dateIso });
    const result = simulateMassBunkDate({ report, dateIso, timetableEntries: d.timetableEntries, calendarEvents: [], attendanceRecords: records, selectedTimetableEntryIds: [slot.id] });
    expect(result.consolidatedImpact.totalMissedUnits).toBe(0);
    expect(result.consolidatedImpact.afterConducted).toBe(result.consolidatedImpact.beforeConducted);
  });
  it('excludes dates blocked by academic calendar', () => {
    const d = buildDemoDataset(new Date('2026-11-10T10:00:00Z'));
    const dateIso = '2026-11-16';
    const report = computeSemesterAttendanceReport({ semester: d.semester, subjects: d.subjects, timetableEntries: d.timetableEntries, calendarEvents: [], attendanceRecords: d.attendanceRecords, asOfDate: dateIso });
    const result = simulateMassBunkDate({ report, dateIso, timetableEntries: d.timetableEntries, calendarEvents: [{ id: 'holiday-test', semesterId: d.semester.id, date: dateIso, eventType: 'official_holiday', title: 'Holiday', affectsClasses: true }], attendanceRecords: d.attendanceRecords, selectedTimetableEntryIds: d.timetableEntries.map(s => s.id) });
    expect(result.consolidatedImpact.totalMissedUnits).toBe(0);
  });
});

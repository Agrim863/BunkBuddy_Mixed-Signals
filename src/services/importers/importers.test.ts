import { describe, expect, it } from 'vitest';
import { parseCsvText } from './csvParser';
import {
  classifyCalendarEventType,
  normalizeDateString,
  normalizeTimeString,
  normalizeWeekday,
} from './dateNormalizer';
import { extractCalendarEventsFromLines } from './pdfCalendarParser';
import {
  guessTimetableColumnMapping,
  mapRowsToTimetableDrafts,
} from './timetableMapper';

describe('Importers & normalizers', () => {
  it('parses RFC-4180 CSV with quoted commas and escaped quotes', () => {
    const csv = [
      'Subject,Code,Day,Start,End,Units,Type',
      '"Algorithms, Part I",CS301,Monday,9:00 AM,10:00 AM,1,Lecture',
      '"Systems ""Lab""",CS302,Thu,14:00,16:00,2,Lab',
    ].join('\n');

    const parsed = parseCsvText(csv);
    expect(parsed.headers).toEqual([
      'Subject',
      'Code',
      'Day',
      'Start',
      'End',
      'Units',
      'Type',
    ]);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]?.Subject).toBe('Algorithms, Part I');
    expect(parsed.rows[1]?.Subject).toBe('Systems "Lab"');
  });

  it('normalizes dates, 12h/24h times, and weekdays', () => {
    expect(normalizeDateString('2026-08-15')).toBe('2026-08-15');
    expect(normalizeDateString('15 Oct 2026')).toBe('2026-10-15');
    expect(normalizeTimeString('2:30 PM')).toBe('14:30');
    expect(normalizeTimeString('09:05')).toBe('09:05');
    expect(normalizeWeekday('Monday')).toBe(1);
    expect(normalizeWeekday('fri')).toBe(5);
    expect(normalizeWeekday('Sunday')).toBe(0);
  });

  it('extracts calendar events and categories from PDF text lines', () => {
    const drafts = extractCalendarEventsFromLines([
      '2026-08-15 Independence Day Official Holiday',
      '12 Oct 2026 to 16 Oct 2026 Mid-Semester Break',
      '2026-11-20 Final Examination Schedule',
      'Random header without any date',
    ]);

    expect(drafts).toHaveLength(3);
    expect(drafts[0]?.eventType).toBe('official_holiday');
    expect(drafts[1]?.date).toBe('2026-10-12');
    expect(drafts[1]?.endDate).toBe('2026-10-16');
    expect(drafts[1]?.eventType).toBe('semester_break');
    expect(drafts[2]?.eventType).toBe('examination');
    expect(classifyCalendarEventType('Non-teaching preparation day')).toBe(
      'non_teaching_day',
    );
  });

  it('maps and validates timetable CSV rows with separate duration and attendance units', () => {
    const csv = [
      'Subject Name,Code,Weekday,Start Time,End Time,Attendance Units,Type',
      'Data Structures,CS201,Mon,09:00,10:00,1,Lecture',
      'DBMS Lab,CS204,Wed,14:00,16:00,1,Lab',
      'Broken Row,CS999,Funday,09:00,10:00,1,Lecture',
    ].join('\n');

    const tabular = parseCsvText(csv);
    const mapping = guessTimetableColumnMapping(tabular.headers);
    const drafts = mapRowsToTimetableDrafts(tabular.rows, mapping, []);

    expect(drafts).toHaveLength(3);
    expect(drafts[0]?.valid).toBe(true);
    expect(drafts[0]?.teachingDurationMinutes).toBe(60);
    expect(drafts[0]?.attendanceUnits).toBe(1);

    expect(drafts[1]?.valid).toBe(true);
    expect(drafts[1]?.teachingDurationMinutes).toBe(120);
    expect(drafts[1]?.attendanceUnits).toBe(1);
    expect(drafts[1]?.sessionType).toBe('lab');

    expect(drafts[2]?.valid).toBe(false);
    expect(drafts[2]?.error).toContain('Unrecognized weekday');
  });
});

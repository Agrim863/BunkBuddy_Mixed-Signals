import { addDays, format, parseISO } from 'date-fns';
import type {
  AttendanceRecord,
  CalendarEvent,
  Semester,
  TimetableEntry,
} from '../types/domain';

export interface ScheduledSession {
  date: string; // YYYY-MM-DD
  weekday: number; // 0-6
  timetableEntryId: string;
  subjectId: string;
  startTime: string;
  endTime: string;
  teachingDurationMinutes: number;
  attendanceUnits: number;
  sessionType: TimetableEntry['sessionType'];
  blockedByEvent: CalendarEvent | null;
  recordedAttendance: AttendanceRecord | null;
  isCountedAsFuturePrediction: boolean;
}

/**
 * Checks whether a calendar event spans a target ISO date (YYYY-MM-DD).
 */
export function doesEventCoverDate(event: CalendarEvent, dateIso: string): boolean {
  const start = event.date;
  const end = event.endDate && event.endDate >= start ? event.endDate : start;
  return dateIso >= start && dateIso <= end;
}

/**
 * Returns all calendar events covering a given date.
 */
export function getCalendarEventsForDate(
  events: CalendarEvent[],
  dateIso: string,
): CalendarEvent[] {
  return events.filter((ev) => doesEventCoverDate(ev, dateIso));
}

/**
 * Determines whether a date is non-teaching (holiday, break, exam period, or cancelled day)
 * based on calendar events.
 * Business rule: holidays & cancelled classes do NOT increase classes conducted.
 */
export function getBlockingCalendarEvent(
  events: CalendarEvent[],
  dateIso: string,
): CalendarEvent | null {
  const covering = getCalendarEventsForDate(events, dateIso);
  // Explicit teaching_day overrides only if no holiday/break/non-teaching event overrides,
  // or if affectsClasses is true on holiday/break/non_teaching_day/cancelled_class/examination.
  const blocking = covering.find(
    (ev) =>
      ev.affectsClasses ||
      ev.eventType === 'official_holiday' ||
      ev.eventType === 'semester_break' ||
      ev.eventType === 'non_teaching_day' ||
      ev.eventType === 'cancelled_class',
  );
  return blocking ?? null;
}

/**
 * Expands the weekly timetable across a date range [fromDate, toDate] clamped to semester bounds.
 * Ensures:
 * 1. Dates before semester.trackingStartDate are NOT expanded as future predictions (prevents double-counting historical classes).
 * 2. Holidays, semester breaks, non-teaching days, and cancelled classes are marked as blocked and NOT counted as future predictions.
 * 3. Slots already logged by a tracked AttendanceRecord are linked and NOT double-counted as future predictions.
 */
export function generateScheduledSessions(params: {
  semester: Semester;
  timetableEntries: TimetableEntry[];
  calendarEvents: CalendarEvent[];
  attendanceRecords: AttendanceRecord[];
  fromDate?: string;
  toDate?: string;
}): ScheduledSession[] {
  const { semester, timetableEntries, calendarEvents, attendanceRecords } = params;

  const effectiveStart = [
    semester.startDate,
    semester.trackingStartDate,
    params.fromDate ?? semester.trackingStartDate,
  ].sort()[2]!;

  const effectiveEnd =
    params.toDate && params.toDate < semester.endDate ? params.toDate : semester.endDate;

  if (effectiveStart > effectiveEnd || timetableEntries.length === 0) {
    return [];
  }

  // Index timetable entries by weekday for O(1) lookup per day
  const byWeekday = new Map<number, TimetableEntry[]>();
  for (const entry of timetableEntries) {
    const bucket = byWeekday.get(entry.weekday) ?? [];
    bucket.push(entry);
    byWeekday.set(entry.weekday, bucket);
  }
  for (const [, list] of byWeekday) {
    list.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  // Index tracked records to avoid double-counting an already confirmed session
  const trackedByEntryDate = new Map<string, AttendanceRecord>();
  for (const rec of attendanceRecords) {
    if (rec.source === 'tracked' && rec.timetableEntryId) {
      trackedByEntryDate.set(`${rec.date}::${rec.timetableEntryId}`, rec);
    }
  }

  const sessions: ScheduledSession[] = [];
  let cursor = parseISO(effectiveStart);
  const endCursor = parseISO(effectiveEnd);

  while (cursor <= endCursor) {
    const dateIso = format(cursor, 'yyyy-MM-dd');
    const weekday = cursor.getDay();
    const slots = byWeekday.get(weekday) ?? [];

    if (slots.length > 0) {
      const blockingEvent = getBlockingCalendarEvent(calendarEvents, dateIso);

      for (const slot of slots) {
        const recorded = trackedByEntryDate.get(`${dateIso}::${slot.id}`) ?? null;
        const isBlocked = blockingEvent !== null;
        const isAlreadyConfirmed = recorded !== null;

        sessions.push({
          date: dateIso,
          weekday,
          timetableEntryId: slot.id,
          subjectId: slot.subjectId,
          startTime: slot.startTime,
          endTime: slot.endTime,
          teachingDurationMinutes: slot.teachingDurationMinutes,
          attendanceUnits: slot.attendanceUnits,
          sessionType: slot.sessionType,
          blockedByEvent: blockingEvent,
          recordedAttendance: recorded,
          isCountedAsFuturePrediction: !isBlocked && !isAlreadyConfirmed,
        });
      }
    }

    cursor = addDays(cursor, 1);
  }

  return sessions;
}

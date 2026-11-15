import { parseISO } from 'date-fns';
import type { SemesterAttendanceReport } from './attendanceAggregator';
import {
  calculateFuturePercentage,
  calculateImmediateSafeBunks,
  calculatePercentagePointDelta,
  calculateRecoveryClasses,
  classifyAttendanceStatus,
  type AttendanceHealthStatus,
} from './attendanceMath';
import { getBlockingCalendarEvent } from './scheduleEngine';
import type {
  AttendanceRecord,
  CalendarEvent,
  Subject,
  TimetableEntry,
} from '../types/domain';

export interface MassBunkLectureItem {
  timetableEntry: TimetableEntry;
  subject: Subject;
  alreadyRecorded: AttendanceRecord | null;
}

export interface MassBunkSubjectImpact {
  subject: Subject;
  missedUnits: number;
  beforeAttended: number;
  beforeConducted: number;
  afterAttended: number;
  afterConducted: number;
  beforePercentage: number | null;
  afterPercentage: number | null;
  percentagePointDelta: number | null;
  statusBefore: AttendanceHealthStatus;
  statusAfter: AttendanceHealthStatus;
  recoveryClassesNeededAfter: number | null;
  immediateSafeBunksAfter: number;
}

export interface MassBunkSimulationResult {
  date: string;
  weekday: number;
  blockingCalendarEvent: CalendarEvent | null;
  scheduledLectures: MassBunkLectureItem[];
  subjectImpacts: MassBunkSubjectImpact[];
  consolidatedImpact: {
    totalMissedUnits: number;
    affectedSubjectsCount: number;
    beforeAttended: number;
    beforeConducted: number;
    afterAttended: number;
    afterConducted: number;
    beforePercentage: number | null;
    afterPercentage: number | null;
    percentagePointDelta: number | null;
    statusBefore: AttendanceHealthStatus;
    statusAfter: AttendanceHealthStatus;
    recoveryClassesNeededAfter: number | null;
    immediateSafeBunksAfter: number;
    newlyBelowThresholdCount: number;
  };
}

/**
 * Simulates a coordinated mass bunk on a chosen date.
 * Business rule: A mass bunk counts as conducted absence (+units to C, +0 to A)
 * and is NEVER automatically classified as an academic holiday.
 */
export function simulateMassBunkDate(params: {
  report: SemesterAttendanceReport;
  dateIso: string;
  timetableEntries: TimetableEntry[];
  calendarEvents: CalendarEvent[];
  attendanceRecords: AttendanceRecord[];
  selectedTimetableEntryIds: string[];
}): MassBunkSimulationResult {
  const {
    report,
    dateIso,
    timetableEntries,
    calendarEvents,
    attendanceRecords,
    selectedTimetableEntryIds,
  } = params;

  const parsedDate = parseISO(dateIso);
  const weekday = Number.isNaN(parsedDate.getTime()) ? 0 : parsedDate.getDay();
  const threshold = report.semester.minimumAttendance;

  const blockingCalendarEvent = getBlockingCalendarEvent(calendarEvents, dateIso);
  const subjectById = new Map(
    report.subjectSummaries.map((s) => [s.subject.id, s]),
  );

  const daySlots = timetableEntries
    .filter((entry) => entry.weekday === weekday)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const scheduledLectures: MassBunkLectureItem[] = [];
  for (const slot of daySlots) {
    const summary = subjectById.get(slot.subjectId);
    if (!summary) continue;
    const alreadyRecorded =
      attendanceRecords.find(
        (r) =>
          r.source === 'tracked' &&
          r.date === dateIso &&
          r.timetableEntryId === slot.id,
      ) ?? null;
    scheduledLectures.push({
      timetableEntry: slot,
      subject: summary.subject,
      alreadyRecorded,
    });
  }

  const selectedSet = new Set(selectedTimetableEntryIds);
  const missedUnitsBySubject = new Map<string, number>();

  for (const lecture of scheduledLectures) {
    if (!selectedSet.has(lecture.timetableEntry.id)) continue;
    // An already recorded session is included in the baseline; never add it twice.
    if (lecture.alreadyRecorded || blockingCalendarEvent) continue;
    const current = missedUnitsBySubject.get(lecture.subject.id) ?? 0;
    missedUnitsBySubject.set(
      lecture.subject.id,
      current + lecture.timetableEntry.attendanceUnits,
    );
  }

  const subjectImpacts: MassBunkSubjectImpact[] = [];
  let totalMissedUnits = 0;
  let newlyBelowThresholdCount = 0;

  for (const [subjectId, missedUnits] of missedUnitsBySubject.entries()) {
    const summary = subjectById.get(subjectId);
    if (!summary) continue;

    totalMissedUnits += missedUnits;

    const afterAttended = summary.attended;
    const afterConducted = summary.conducted + missedUnits;
    const afterPercentage = calculateFuturePercentage(
      summary.attended,
      summary.conducted,
      0,
      missedUnits,
    );
    const statusAfter = classifyAttendanceStatus(afterPercentage, threshold);

    if (summary.status !== 'danger' && statusAfter === 'danger') {
      newlyBelowThresholdCount++;
    }

    subjectImpacts.push({
      subject: summary.subject,
      missedUnits,
      beforeAttended: summary.attended,
      beforeConducted: summary.conducted,
      afterAttended,
      afterConducted,
      beforePercentage: summary.percentage,
      afterPercentage,
      percentagePointDelta: calculatePercentagePointDelta(
        summary.percentage,
        afterPercentage,
      ),
      statusBefore: summary.status,
      statusAfter,
      recoveryClassesNeededAfter: calculateRecoveryClasses(
        afterAttended,
        afterConducted,
        threshold,
      ),
      immediateSafeBunksAfter: calculateImmediateSafeBunks(
        afterAttended,
        afterConducted,
        threshold,
      ),
    });
  }

  const beforeAttended = report.overall.attended;
  const beforeConducted = report.overall.conducted;
  const afterAttended = beforeAttended;
  const afterConducted = beforeConducted + totalMissedUnits;
  const afterPercentage = calculateFuturePercentage(
    beforeAttended,
    beforeConducted,
    0,
    totalMissedUnits,
  );
  const statusAfter = classifyAttendanceStatus(afterPercentage, threshold);

  return {
    date: dateIso,
    weekday,
    blockingCalendarEvent,
    scheduledLectures,
    subjectImpacts,
    consolidatedImpact: {
      totalMissedUnits,
      affectedSubjectsCount: subjectImpacts.length,
      beforeAttended,
      beforeConducted,
      afterAttended,
      afterConducted,
      beforePercentage: report.overall.percentage,
      afterPercentage,
      percentagePointDelta: calculatePercentagePointDelta(
        report.overall.percentage,
        afterPercentage,
      ),
      statusBefore: report.overall.status,
      statusAfter,
      recoveryClassesNeededAfter: calculateRecoveryClasses(
        afterAttended,
        afterConducted,
        threshold,
      ),
      immediateSafeBunksAfter: calculateImmediateSafeBunks(
        afterAttended,
        afterConducted,
        threshold,
      ),
      newlyBelowThresholdCount,
    },
  };
}

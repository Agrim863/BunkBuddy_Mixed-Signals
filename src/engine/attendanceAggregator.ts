import { localDateISO } from '../utils/localDate';
import {
  calculateFuturePercentage,
  calculateImmediateSafeBunks,
  calculatePercentage,
  calculateRecoveryClasses,
  calculateSemesterAbsenceBudget,
  classifyAttendanceStatus,
  type AttendanceHealthStatus,
} from './attendanceMath';
import { generateScheduledSessions, type ScheduledSession } from './scheduleEngine';
import type {
  AttendanceRecord,
  CalendarEvent,
  Semester,
  Subject,
  TimetableEntry,
} from '../types/domain';

export interface SubjectAttendanceSummary {
  subject: Subject;
  historicalConducted: number;
  historicalAttended: number;
  trackedConducted: number;
  trackedAttended: number;
  trackedMissed: number;
  trackedMassBunkUnits: number;
  trackedCancelledUnits: number;
  conducted: number;
  attended: number;
  missed: number;
  percentage: number | null;
  requiredPercentage: number;
  status: AttendanceHealthStatus;
  recoveryClassesNeeded: number | null;
  immediateSafeBunks: number;
  remainingScheduledUnits: number;
  remainingScheduledSessions: number;
  semesterAbsenceBudget: number;
  projectedIfAttendAllPercentage: number | null;
}

export interface OverallAttendanceSummary {
  conducted: number;
  attended: number;
  missed: number;
  percentage: number | null;
  requiredPercentage: number;
  status: AttendanceHealthStatus;
  recoveryClassesNeeded: number | null;
  immediateSafeBunks: number;
  remainingScheduledUnits: number;
  semesterAbsenceBudget: number;
  projectedIfAttendAllPercentage: number | null;
  subjectsBelowThreshold: SubjectAttendanceSummary[];
  subjectsBorderline: SubjectAttendanceSummary[];
}

export interface SemesterAttendanceReport {
  semester: Semester;
  asOfDate: string;
  subjectSummaries: SubjectAttendanceSummary[];
  overall: OverallAttendanceSummary;
  upcomingSessions: ScheduledSession[];
}

/**
 * Interprets how a tracked AttendanceRecord affects Conducted (C) and Attended (A).
 * Business rules:
 * - 'present' -> +units A, +units C
 * - 'absent' -> +0 A, +units C
 * - 'mass_bunk' -> +0 A, +units C (counts as absence when conducted)
 * - 'cancelled' -> +0 A, +0 C (cancelled classes do NOT increase conducted)
 * - 'holiday' -> +0 A, +0 C (holidays do NOT increase conducted)
 */
export function getAttendanceRecordContribution(record: AttendanceRecord): {
  attendedDelta: number;
  conductedDelta: number;
  missedDelta: number;
  massBunkDelta: number;
  cancelledDelta: number;
} {
  // Historical log entries are audit-only so they never double-count against subject.historicalConducted/Attended
  if (record.source === 'historical_log') {
    return {
      attendedDelta: 0,
      conductedDelta: 0,
      missedDelta: 0,
      massBunkDelta: 0,
      cancelledDelta: 0,
    };
  }

  const units = Math.max(0, record.attendanceUnits);

  switch (record.status) {
    case 'present':
      return {
        attendedDelta: units,
        conductedDelta: units,
        missedDelta: 0,
        massBunkDelta: 0,
        cancelledDelta: 0,
      };
    case 'absent':
      return {
        attendedDelta: 0,
        conductedDelta: units,
        missedDelta: units,
        massBunkDelta: 0,
        cancelledDelta: 0,
      };
    case 'mass_bunk':
      return {
        attendedDelta: 0,
        conductedDelta: units,
        missedDelta: units,
        massBunkDelta: units,
        cancelledDelta: 0,
      };
    case 'cancelled':
      return {
        attendedDelta: 0,
        conductedDelta: 0,
        missedDelta: 0,
        massBunkDelta: 0,
        cancelledDelta: units,
      };
    case 'holiday':
      return {
        attendedDelta: 0,
        conductedDelta: 0,
        missedDelta: 0,
        massBunkDelta: 0,
        cancelledDelta: 0,
      };
  }
}

export function computeSemesterAttendanceReport(params: {
  semester: Semester;
  subjects: Subject[];
  timetableEntries: TimetableEntry[];
  calendarEvents: CalendarEvent[];
  attendanceRecords: AttendanceRecord[];
  asOfDate?: string;
}): SemesterAttendanceReport {
  const {
    semester,
    subjects,
    timetableEntries,
    calendarEvents,
    attendanceRecords,
  } = params;

  const todayIso = localDateISO();
  const asOfDate = params.asOfDate ?? todayIso;
  const threshold = semester.minimumAttendance;
  const requiredPercentage = threshold * 100;

  // Future predictions start from max(trackingStartDate, asOfDate)
  const predictionStart =
    asOfDate > semester.trackingStartDate ? asOfDate : semester.trackingStartDate;

  const futureSessions = generateScheduledSessions({
    semester,
    timetableEntries,
    calendarEvents,
    attendanceRecords,
    fromDate: predictionStart,
    toDate: semester.endDate,
  });

  const upcomingSessions = futureSessions.filter((s) => s.isCountedAsFuturePrediction);

  const subjectSummaries: SubjectAttendanceSummary[] = subjects.map((subject) => {
    const historicalConducted =
      semester.mode === 'fresh' ? 0 : Math.max(0, subject.historicalConducted);
    const historicalAttended =
      semester.mode === 'fresh'
        ? 0
        : Math.min(historicalConducted, Math.max(0, subject.historicalAttended));

    let trackedConducted = 0;
    let trackedAttended = 0;
    let trackedMissed = 0;
    let trackedMassBunkUnits = 0;
    let trackedCancelledUnits = 0;

    for (const record of attendanceRecords) {
      if (record.subjectId !== subject.id) continue;
      // Only include tracked records from trackingStartDate onward (never double-count pre-tracking baseline)
      if (record.source === 'tracked' && record.date < semester.trackingStartDate) {
        continue;
      }
      const contrib = getAttendanceRecordContribution(record);
      trackedConducted += contrib.conductedDelta;
      trackedAttended += contrib.attendedDelta;
      trackedMissed += contrib.missedDelta;
      trackedMassBunkUnits += contrib.massBunkDelta;
      trackedCancelledUnits += contrib.cancelledDelta;
    }

    const conducted = historicalConducted + trackedConducted;
    const attended = historicalAttended + trackedAttended;
    const missed = Math.max(0, conducted - attended);

    const percentage = calculatePercentage(attended, conducted);
    const status = classifyAttendanceStatus(percentage, threshold);
    const recoveryClassesNeeded = calculateRecoveryClasses(
      attended,
      conducted,
      threshold,
    );
    const immediateSafeBunks = calculateImmediateSafeBunks(
      attended,
      conducted,
      threshold,
    );

    const subjectFuture = upcomingSessions.filter((s) => s.subjectId === subject.id);
    const remainingScheduledUnits = subjectFuture.reduce(
      (sum, s) => sum + s.attendanceUnits,
      0,
    );

    const semesterAbsenceBudget = calculateSemesterAbsenceBudget(
      attended,
      conducted,
      remainingScheduledUnits,
      threshold,
    );

    const projectedIfAttendAllPercentage = calculateFuturePercentage(
      attended,
      conducted,
      remainingScheduledUnits,
      remainingScheduledUnits,
    );

    return {
      subject,
      historicalConducted,
      historicalAttended,
      trackedConducted,
      trackedAttended,
      trackedMissed,
      trackedMassBunkUnits,
      trackedCancelledUnits,
      conducted,
      attended,
      missed,
      percentage,
      requiredPercentage,
      status,
      recoveryClassesNeeded,
      immediateSafeBunks,
      remainingScheduledUnits,
      remainingScheduledSessions: subjectFuture.length,
      semesterAbsenceBudget,
      projectedIfAttendAllPercentage,
    };
  });

  // Overall metrics aggregate across all subjects independently from individual percentages
  const totalConducted = subjectSummaries.reduce((acc, s) => acc + s.conducted, 0);
  const totalAttended = subjectSummaries.reduce((acc, s) => acc + s.attended, 0);
  const totalMissed = Math.max(0, totalConducted - totalAttended);
  const totalRemainingUnits = subjectSummaries.reduce(
    (acc, s) => acc + s.remainingScheduledUnits,
    0,
  );

  const overallPercentage = calculatePercentage(totalAttended, totalConducted);
  const overallStatus = classifyAttendanceStatus(overallPercentage, threshold);

  const overall: OverallAttendanceSummary = {
    conducted: totalConducted,
    attended: totalAttended,
    missed: totalMissed,
    percentage: overallPercentage,
    requiredPercentage,
    status: overallStatus,
    recoveryClassesNeeded: calculateRecoveryClasses(
      totalAttended,
      totalConducted,
      threshold,
    ),
    immediateSafeBunks: calculateImmediateSafeBunks(
      totalAttended,
      totalConducted,
      threshold,
    ),
    remainingScheduledUnits: totalRemainingUnits,
    semesterAbsenceBudget: calculateSemesterAbsenceBudget(
      totalAttended,
      totalConducted,
      totalRemainingUnits,
      threshold,
    ),
    projectedIfAttendAllPercentage: calculateFuturePercentage(
      totalAttended,
      totalConducted,
      totalRemainingUnits,
      totalRemainingUnits,
    ),
    subjectsBelowThreshold: subjectSummaries.filter((s) => s.status === 'danger'),
    subjectsBorderline: subjectSummaries.filter((s) => s.status === 'borderline'),
  };

  return {
    semester,
    asOfDate,
    subjectSummaries,
    overall,
    upcomingSessions,
  };
}

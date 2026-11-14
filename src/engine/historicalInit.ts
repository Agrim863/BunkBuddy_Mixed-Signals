import type {
  AttendanceRecord,
  Semester,
  SemesterMode,
  Subject,
} from '../types/domain';

export interface SubjectBaselineInput {
  subjectId: string;
  conducted: number;
  attended: number;
}

export interface HistoricalInitValidation {
  valid: boolean;
  errors: string[];
}

/**
 * Applies Fresh vs Ongoing baseline rules cleanly so Fresh semesters always start at 0/0
 * and Ongoing semesters enforce 0 <= attended <= conducted.
 */
export function normalizeHistoricalBaselines(
  mode: SemesterMode,
  subjects: Subject[],
  inputs: SubjectBaselineInput[],
): Subject[] {
  const byId = new Map(inputs.map((i) => [i.subjectId, i]));

  return subjects.map((subject) => {
    if (mode === 'fresh') {
      return {
        ...subject,
        historicalConducted: 0,
        historicalAttended: 0,
      };
    }

    const patch = byId.get(subject.id);
    if (!patch) return subject;

    const conducted = Math.max(0, Math.floor(patch.conducted));
    const attended = Math.min(conducted, Math.max(0, Math.floor(patch.attended)));
    return {
      ...subject,
      historicalConducted: conducted,
      historicalAttended: attended,
    };
  });
}

/**
 * Validates historical initialization state across semester tracking date and subject baselines.
 */
export function validateHistoricalInitialization(
  semester: Pick<Semester, 'mode' | 'startDate' | 'endDate' | 'trackingStartDate'>,
  subjects: Subject[],
  historicalLogs: AttendanceRecord[],
): HistoricalInitValidation {
  const errors: string[] = [];

  if (
    semester.trackingStartDate < semester.startDate ||
    semester.trackingStartDate > semester.endDate
  ) {
    errors.push(
      `Tracking start date (${semester.trackingStartDate}) must be within semester bounds (${semester.startDate} to ${semester.endDate}).`,
    );
  }

  if (semester.mode === 'fresh') {
    for (const sub of subjects) {
      if (sub.historicalConducted !== 0 || sub.historicalAttended !== 0) {
        errors.push(`Fresh semester subject "${sub.name}" must start with 0/0 attendance.`);
      }
    }
  } else {
    for (const sub of subjects) {
      if (sub.historicalConducted < 0 || sub.historicalAttended < 0) {
        errors.push(`Subject "${sub.name}" cannot have negative historical counts.`);
      }
      if (sub.historicalAttended > sub.historicalConducted) {
        errors.push(
          `Subject "${sub.name}" attended classes (${sub.historicalAttended}) cannot exceed conducted (${sub.historicalConducted}).`,
        );
      }
    }

    for (const log of historicalLogs) {
      if (log.source === 'historical_log' && log.date >= semester.trackingStartDate) {
        errors.push(
          `Historical log on ${log.date} must precede trackingStartDate (${semester.trackingStartDate}) to prevent double-counting.`,
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Prevents duplicate tracked attendance records for the same subject, date, and timetable slot.
 */
export function hasDuplicateAttendanceRecord(
  existingRecords: AttendanceRecord[],
  candidate: Pick<AttendanceRecord, 'subjectId' | 'date' | 'timetableEntryId' | 'source'> & Partial<Pick<AttendanceRecord, 'status' | 'attendanceUnits' | 'notes'>>,
  excludeRecordId?: string,
): boolean {
  return existingRecords.some((rec) => {
    if (excludeRecordId && rec.id === excludeRecordId) return false;
    if (rec.subjectId !== candidate.subjectId) return false;
    if (rec.date !== candidate.date) return false;
    if (rec.source !== candidate.source) return false;
    const recSlot = rec.timetableEntryId ?? null;
    const candSlot = candidate.timetableEntryId ?? null;
    if (recSlot !== candSlot) return false;
    if (candSlot !== null) return true;
    // Slot-less records may represent multiple classes on one date.
    // Reject identical submissions, while allowing explicitly distinguished sessions.
    return rec.status === candidate.status &&
      rec.attendanceUnits === candidate.attendanceUnits &&
      (rec.notes ?? '').trim() === (candidate.notes ?? '').trim();
  });
}

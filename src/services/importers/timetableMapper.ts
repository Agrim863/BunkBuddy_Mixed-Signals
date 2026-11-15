import { computeDurationMinutes, timetableEntrySchema } from '../../schemas/timetable.schema';
import type { SessionType, Subject } from '../../types/domain';
import {
  normalizeSessionType,
  normalizeTimeString,
  normalizeWeekday,
} from './dateNormalizer';

export interface TimetableColumnMapping {
  subjectName: string;
  subjectCode: string;
  weekday: string;
  startTime: string;
  endTime: string;
  attendanceUnits: string;
  sessionType: string;
}

export interface ParsedTimetableDraft {
  id: string;
  rowNumber: number;
  subjectId: string | null;
  subjectName: string;
  subjectCode: string;
  weekday: number | null;
  startTime: string;
  endTime: string;
  teachingDurationMinutes: number;
  attendanceUnits: number;
  sessionType: SessionType;
  valid: boolean;
  error?: string;
}

export function guessTimetableColumnMapping(headers: string[]): TimetableColumnMapping {
  const findHeader = (candidates: string[]): string => {
    for (const header of headers) {
      const lower = header.toLowerCase();
      if (candidates.some((c) => lower.includes(c))) {
        return header;
      }
    }
    return '';
  };

  return {
    subjectName: findHeader(['subject name', 'subject', 'course name', 'course']),
    subjectCode: findHeader(['code', 'course code', 'subject code']),
    weekday: findHeader(['day', 'weekday']),
    startTime: findHeader(['start', 'from']),
    endTime: findHeader(['end', 'to']),
    attendanceUnits: findHeader(['unit', 'weight', 'periods', 'credits']),
    sessionType: findHeader(['type', 'category', 'kind', 'format']),
  };
}

export function mapRowsToTimetableDrafts(
  rows: Record<string, string>[],
  mapping: TimetableColumnMapping,
  existingSubjects: Subject[],
): ParsedTimetableDraft[] {
  return rows.map((row, idx) => {
    const rawName = mapping.subjectName ? (row[mapping.subjectName] ?? '').trim() : '';
    const rawCode = mapping.subjectCode ? (row[mapping.subjectCode] ?? '').trim().toUpperCase() : '';
    const rawDay = mapping.weekday ? (row[mapping.weekday] ?? '') : '';
    const rawStart = mapping.startTime ? (row[mapping.startTime] ?? '') : '';
    const rawEnd = mapping.endTime ? (row[mapping.endTime] ?? '') : '';
    const rawUnits = mapping.attendanceUnits ? (row[mapping.attendanceUnits] ?? '') : '';
    const rawType = mapping.sessionType ? (row[mapping.sessionType] ?? '') : '';

    const weekday = normalizeWeekday(rawDay);
    const startTime = normalizeTimeString(rawStart) ?? '';
    const endTime = normalizeTimeString(rawEnd) ?? '';
    const duration = computeDurationMinutes(startTime, endTime);
    const parsedUnits = rawUnits ? Number.parseInt(rawUnits, 10) : 1;
    const attendanceUnits = Number.isFinite(parsedUnits) && parsedUnits > 0 ? parsedUnits : 1;
    const sessionType = normalizeSessionType(rawType);

    const matchedSubject = existingSubjects.find(
      (s) =>
        (rawCode && s.code.toUpperCase() === rawCode) ||
        (rawName && s.name.toLowerCase() === rawName.toLowerCase()),
    );

    const subjectName = rawName || matchedSubject?.name || rawCode;
    const subjectCode =
      rawCode ||
      matchedSubject?.code ||
      rawName
        .replace(/[^A-Za-z0-9]/g, '')
        .slice(0, 6)
        .toUpperCase();

    if (!subjectName && !subjectCode) {
      return {
        id: `tt-row-${idx}`,
        rowNumber: idx + 2,
        subjectId: null,
        subjectName: '',
        subjectCode: '',
        weekday,
        startTime,
        endTime,
        teachingDurationMinutes: duration,
        attendanceUnits,
        sessionType,
        valid: false,
        error: 'Missing subject name or code',
      };
    }

    if (weekday === null) {
      return {
        id: `tt-row-${idx}`,
        rowNumber: idx + 2,
        subjectId: matchedSubject?.id ?? null,
        subjectName,
        subjectCode,
        weekday: null,
        startTime,
        endTime,
        teachingDurationMinutes: duration,
        attendanceUnits,
        sessionType,
        valid: false,
        error: `Unrecognized weekday "${rawDay || '(empty)'}"`,
      };
    }

    const validation = timetableEntrySchema.safeParse({
      subjectId: matchedSubject?.id ?? 'new-subject-placeholder',
      weekday,
      startTime,
      endTime,
      teachingDurationMinutes: duration,
      attendanceUnits,
      sessionType,
    });

    if (!validation.success) {
      return {
        id: `tt-row-${idx}`,
        rowNumber: idx + 2,
        subjectId: matchedSubject?.id ?? null,
        subjectName,
        subjectCode,
        weekday,
        startTime,
        endTime,
        teachingDurationMinutes: duration,
        attendanceUnits,
        sessionType,
        valid: false,
        error: validation.error.issues[0]?.message ?? 'Invalid timetable entry',
      };
    }

    return {
      id: `tt-row-${idx}`,
      rowNumber: idx + 2,
      subjectId: matchedSubject?.id ?? null,
      subjectName,
      subjectCode,
      weekday,
      startTime,
      endTime,
      teachingDurationMinutes: validation.data.teachingDurationMinutes,
      attendanceUnits: validation.data.attendanceUnits,
      sessionType: validation.data.sessionType,
      valid: true,
    };
  });
}

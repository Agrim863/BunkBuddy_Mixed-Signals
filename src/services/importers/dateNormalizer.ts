import { format, isValid, parse } from 'date-fns';
import type { CalendarEventType, SessionType } from '../../types/domain';
import { defaultAffectsClassesForEvent } from '../../schemas/calendar.schema';

const DATE_FORMATS = [
  'yyyy-MM-dd',
  'yyyy/MM/dd',
  'dd-MM-yyyy',
  'dd.MM.yyyy',
  'd.M.yyyy',
  'dd/MM/yyyy',
  'd-M-yyyy',
  'd/M/yyyy',
  'dd MMM yyyy',
  'd MMM yyyy',
  'dd MMMM yyyy',
  'd MMMM yyyy',
  'MMM dd, yyyy',
  'MMM d, yyyy',
  'MMMM dd, yyyy',
  'MMMM d, yyyy',
  'MMM dd yyyy',
  'd-MMM-yyyy',
  'dd-MMM-yyyy',
  'MM/dd/yyyy',
];

export function normalizeDateString(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Excel serial date check (e.g., 45000..55000)
  if (/^\d{5}(\.\d+)?$/.test(trimmed)) {
    const serial = Number(trimmed);
    if (serial > 30000 && serial < 70000) {
      const utcDays = Math.floor(serial - 25569);
      const date = new Date(utcDays * 86400 * 1000);
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString().slice(0, 10);
      }
    }
  }

  for (const fmt of DATE_FORMATS) {
    const parsed = parse(trimmed, fmt, new Date());
    if (isValid(parsed) && parsed.getFullYear() >= 1990 && parsed.getFullYear() <= 2100) {
      return format(parsed, 'yyyy-MM-dd');
    }
  }

  const native = new Date(trimmed);
  if (!Number.isNaN(native.getTime()) && native.getFullYear() >= 1990 && native.getFullYear() <= 2100) {
    return format(native, 'yyyy-MM-dd');
  }

  return null;
}

export function normalizeTimeString(raw: string): string | null {
  const trimmed = raw.trim().toUpperCase();
  if (!trimmed) return null;

  // Excel fractional day time (0 <= val < 1)
  if (/^0?\.\d+$/.test(trimmed)) {
    const fraction = Number(trimmed);
    if (fraction >= 0 && fraction < 1) {
      const totalMinutes = Math.round(fraction * 24 * 60);
      const hh = Math.floor(totalMinutes / 60) % 24;
      const mm = totalMinutes % 60;
      return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    }
  }

  // 24h HH:mm or H:mm
  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (match24) {
    const hh = Number(match24[1]);
    const mm = Number(match24[2]);
    if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
      return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    }
  }

  // 12h h:mm AM/PM
  const match12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (match12) {
    let hh = Number(match12[1]);
    const mm = Number(match12[2]);
    const meridiem = match12[3];
    if (hh >= 1 && hh <= 12 && mm >= 0 && mm <= 59) {
      if (meridiem === 'AM' && hh === 12) hh = 0;
      if (meridiem === 'PM' && hh < 12) hh += 12;
      return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    }
  }

  return null;
}

const WEEKDAY_MAP: Record<string, number> = {
  sun: 0,
  sunday: 0,
  '0': 0,
  mon: 1,
  monday: 1,
  '1': 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  '2': 2,
  wed: 3,
  wednesday: 3,
  '3': 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  '4': 4,
  fri: 5,
  friday: 5,
  '5': 5,
  sat: 6,
  saturday: 6,
  '6': 6,
  '7': 0,
};

export function normalizeWeekday(raw: string): number | null {
  const key = raw.trim().toLowerCase();
  return key in WEEKDAY_MAP ? (WEEKDAY_MAP[key] ?? null) : null;
}

export function normalizeSessionType(raw: string): SessionType {
  const lower = raw.trim().toLowerCase();
  if (lower.includes('lab') || lower.includes('pract')) return 'lab';
  if (lower.includes('tut')) return 'tutorial';
  return 'lecture';
}

export function classifyCalendarEventType(raw: string): CalendarEventType {
  const lower = raw.trim().toLowerCase();
  if (lower.includes('cancel')) return 'cancelled_class';
  if (lower.includes('non-teaching') || lower.includes('non teaching') || lower.includes('no class')) {
    return 'non_teaching_day';
  }
  if (lower.includes('break') || lower.includes('vacation') || lower.includes('recess')) {
    return 'semester_break';
  }
  if (
    lower.includes('exam') ||
    lower.includes('midsem') ||
    lower.includes('mid-sem') ||
    lower.includes('endsem') ||
    lower.includes('end-sem') ||
    lower.includes('test') ||
    lower.includes('assessment')
  ) {
    return 'examination';
  }
  if (lower.includes('holiday') || lower.includes('closed') || lower.includes('gazetted')) {
    return 'official_holiday';
  }
  if (lower.includes('teaching') || lower.includes('commencement') || lower.includes('working day')) {
    return 'teaching_day';
  }
  if (
    lower.includes('event') ||
    lower.includes('fest') ||
    lower.includes('convocation') ||
    lower.includes('seminar') ||
    lower.includes('cultural') ||
    lower.includes('sports')
  ) {
    return 'college_event';
  }
  return 'official_holiday';
}

export function getDefaultAffectsClasses(eventType: CalendarEventType): boolean {
  return defaultAffectsClassesForEvent(eventType);
}

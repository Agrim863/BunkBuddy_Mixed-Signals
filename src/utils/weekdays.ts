export const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export const WEEKDAY_SHORT_NAMES = [
  'Sun',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
] as const;

/** Academic display order: Monday (1) through Sunday (0) */
export const ACADEMIC_WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export function getWeekdayName(weekday: number): string {
  return WEEKDAY_NAMES[weekday] ?? 'Unknown';
}

export function getWeekdayShortName(weekday: number): string {
  return WEEKDAY_SHORT_NAMES[weekday] ?? '?';
}

export function formatDurationMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins === 0 ? `${hrs} hr` : `${hrs}h ${mins}m`;
}

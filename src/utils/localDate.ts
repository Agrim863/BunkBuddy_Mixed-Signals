import { format } from 'date-fns';

/** Calendar date in the user's local timezone, never UTC. */
export function localDateISO(date: Date = new Date()): string {
  return format(date, 'yyyy-MM-dd');
}

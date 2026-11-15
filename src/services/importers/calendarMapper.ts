import { calendarEventSchema } from '../../schemas/calendar.schema';
import type { CalendarEventType } from '../../types/domain';
import {
  classifyCalendarEventType,
  getDefaultAffectsClasses,
  normalizeDateString,
} from './dateNormalizer';
import type { ParsedCalendarDraft } from './pdfCalendarParser';

export interface CalendarColumnMapping {
  date: string;
  endDate: string;
  title: string;
  eventType: string;
  description: string;
}

export function guessCalendarColumnMapping(headers: string[]): CalendarColumnMapping {
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
    date: findHeader(['start date', 'date', 'from']),
    endDate: findHeader(['end date', 'until', 'to date']),
    title: findHeader(['title', 'event', 'holiday', 'occasion', 'name', 'subject']),
    eventType: findHeader(['type', 'category', 'kind']),
    description: findHeader(['desc', 'note', 'remarks', 'detail']),
  };
}

export function mapRowsToCalendarDrafts(
  rows: Record<string, string>[],
  mapping: CalendarColumnMapping,
): ParsedCalendarDraft[] {
  return rows.map((row, idx) => {
    const rawDate = mapping.date ? (row[mapping.date] ?? '') : '';
    const rawEndDate = mapping.endDate ? (row[mapping.endDate] ?? '') : '';
    const rawTitle = mapping.title ? (row[mapping.title] ?? '') : '';
    const rawType = mapping.eventType ? (row[mapping.eventType] ?? '') : '';
    const rawDesc = mapping.description ? (row[mapping.description] ?? '') : '';

    const normalizedDate = normalizeDateString(rawDate);
    const normalizedEndDate = rawEndDate ? normalizeDateString(rawEndDate) : null;
    const eventType: CalendarEventType = classifyCalendarEventType(
      `${rawType} ${rawTitle}`.trim(),
    );
    const title = rawTitle.trim() || rawType.trim() || `Calendar Event #${idx + 1}`;
    const affectsClasses = getDefaultAffectsClasses(eventType);

    if (!normalizedDate) {
      return {
        id: `row-${idx}-${crypto.randomUUID().slice(0, 6)}`,
        date: rawDate,
        endDate: normalizedEndDate ?? undefined,
        eventType,
        title,
        description: rawDesc || undefined,
        affectsClasses,
        sourceInfo: `Row ${idx + 2}`,
        valid: false,
        error: `Could not parse date "${rawDate || '(empty)'}"`,
      };
    }

    const parsed = calendarEventSchema.safeParse({
      date: normalizedDate,
      endDate: normalizedEndDate ?? undefined,
      eventType,
      title,
      description: rawDesc || undefined,
      affectsClasses,
    });

    if (!parsed.success) {
      return {
        id: `row-${idx}-${crypto.randomUUID().slice(0, 6)}`,
        date: normalizedDate,
        endDate: normalizedEndDate ?? undefined,
        eventType,
        title,
        description: rawDesc || undefined,
        affectsClasses,
        sourceInfo: `Row ${idx + 2}`,
        valid: false,
        error: parsed.error.issues[0]?.message ?? 'Invalid calendar event row',
      };
    }

    return {
      id: `row-${idx}-${crypto.randomUUID().slice(0, 6)}`,
      date: parsed.data.date,
      endDate: parsed.data.endDate || undefined,
      eventType: parsed.data.eventType,
      title: parsed.data.title,
      description: parsed.data.description,
      affectsClasses: parsed.data.affectsClasses,
      sourceInfo: `Row ${idx + 2}`,
      valid: true,
    };
  });
}

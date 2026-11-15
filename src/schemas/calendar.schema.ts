import { z } from 'zod';

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const calendarEventTypes = [
  'teaching_day',
  'official_holiday',
  'semester_break',
  'examination',
  'college_event',
  'non_teaching_day',
  'cancelled_class',
] as const;

export const calendarEventSchema = z
  .object({
    date: z.string().regex(isoDateRegex, 'Date must be YYYY-MM-DD'),
    endDate: z
      .string()
      .regex(isoDateRegex, 'End date must be YYYY-MM-DD')
      .optional()
      .or(z.literal('')),
    eventType: z.enum(calendarEventTypes),
    title: z
      .string()
      .trim()
      .min(2, 'Event title must be at least 2 characters')
      .max(100, 'Event title is too long'),
    description: z.string().trim().max(300, 'Description is too long').optional(),
    affectsClasses: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.endDate && data.endDate < data.date) {
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'End date cannot precede start date',
      });
    }
  });

export type CalendarEventInput = z.infer<typeof calendarEventSchema>;

export function defaultAffectsClassesForEvent(
  eventType: (typeof calendarEventTypes)[number],
): boolean {
  switch (eventType) {
    case 'official_holiday':
    case 'semester_break':
    case 'non_teaching_day':
    case 'cancelled_class':
    case 'examination':
      return true;
    case 'teaching_day':
    case 'college_event':
      return false;
  }
}

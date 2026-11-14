import { z } from 'zod';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseTimeToMinutes(timeStr: string): number {
  const parts = timeStr.split(':');
  const h = Number(parts[0] ?? 0);
  const m = Number(parts[1] ?? 0);
  return h * 60 + m;
}

export function computeDurationMinutes(startTime: string, endTime: string): number {
  if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) return 0;
  const diff = parseTimeToMinutes(endTime) - parseTimeToMinutes(startTime);
  return diff > 0 ? diff : 0;
}

export const timetableEntrySchema = z
  .object({
    subjectId: z.string().min(1, 'Select a subject'),
    weekday: z.number().int().min(0).max(6),
    startTime: z.string().regex(timeRegex, 'Use HH:mm (24h) format'),
    endTime: z.string().regex(timeRegex, 'Use HH:mm (24h) format'),
    teachingDurationMinutes: z
      .number({ error: 'Duration must be a number' })
      .int()
      .min(15, 'Minimum duration is 15 minutes')
      .max(480, 'Maximum duration is 480 minutes'),
    attendanceUnits: z
      .number({ error: 'Attendance units must be a number' })
      .int()
      .min(1, 'At least 1 attendance unit is required')
      .max(12, 'Maximum 12 units per entry'),
    sessionType: z.enum(['lecture', 'lab', 'tutorial']),
  })
  .superRefine((data, ctx) => {
    if (parseTimeToMinutes(data.endTime) <= parseTimeToMinutes(data.startTime)) {
      ctx.addIssue({
        code: 'custom',
        path: ['endTime'],
        message: 'End time must be after start time',
      });
    }
  });

export type TimetableEntryInput = z.infer<typeof timetableEntrySchema>;

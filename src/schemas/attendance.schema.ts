import { z } from 'zod';

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const attendanceRecordSchema = z.object({
  subjectId: z.string().min(1, 'Subject is required'),
  timetableEntryId: z.string().nullable().optional(),
  date: z.string().regex(isoDateRegex, 'Date must be YYYY-MM-DD'),
  status: z.enum(['present', 'absent', 'cancelled', 'holiday', 'mass_bunk']),
  attendanceUnits: z.number().int().min(1, 'Units must be at least 1').max(12),
  source: z.enum(['tracked', 'historical_log']),
  notes: z.string().trim().max(240).optional(),
});

export const historicalInitializationSchema = z.object({
  trackingStartDate: z.string().regex(isoDateRegex, 'Tracking start date must be YYYY-MM-DD'),
  subjectTotals: z.array(
    z
      .object({
        subjectId: z.string().min(1),
        conducted: z.number().int().min(0, 'Conducted cannot be negative'),
        attended: z.number().int().min(0, 'Attended cannot be negative'),
      })
      .superRefine((row, ctx) => {
        if (row.attended > row.conducted) {
          ctx.addIssue({
            code: 'custom',
            path: ['attended'],
            message: 'Attended cannot exceed conducted classes',
          });
        }
      }),
  ),
});

export type AttendanceRecordInput = z.infer<typeof attendanceRecordSchema>;

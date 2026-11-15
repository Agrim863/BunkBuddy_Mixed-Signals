import { z } from 'zod';

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const semesterSetupSchema = z
  .object({
    mode: z.enum(['fresh', 'ongoing']),
    name: z
      .string()
      .trim()
      .min(2, 'Semester name must be at least 2 characters')
      .max(80, 'Semester name is too long'),
    institutionName: z.string().trim().max(120, 'Institution name is too long').optional(),
    startDate: z.string().regex(isoDateRegex, 'Start date must be YYYY-MM-DD'),
    endDate: z.string().regex(isoDateRegex, 'End date must be YYYY-MM-DD'),
    trackingStartDate: z.string().regex(isoDateRegex, 'Tracking date must be YYYY-MM-DD'),
    minimumAttendancePercent: z
      .number({ error: 'Enter a valid percentage' })
      .min(1, 'Minimum threshold must be at least 1%')
      .max(99, 'Minimum threshold cannot exceed 99%'),
  })
  .superRefine((data, ctx) => {
    if (data.endDate < data.startDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'End date must be on or after start date',
      });
    }
    if (data.trackingStartDate < data.startDate || data.trackingStartDate > data.endDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['trackingStartDate'],
        message: 'Tracking date must fall within semester start and end dates',
      });
    }
  });

export type SemesterSetupInput = z.infer<typeof semesterSetupSchema>;

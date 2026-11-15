import { z } from 'zod';

export const subjectSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Subject name must be at least 2 characters')
      .max(80, 'Subject name is too long'),
    code: z
      .string()
      .trim()
      .min(2, 'Subject code must be at least 2 characters')
      .max(20, 'Subject code is too long')
      .transform((val) => val.toUpperCase()),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Select a valid hex color'),
    historicalConducted: z.number().int().min(0, 'Cannot be negative'),
    historicalAttended: z.number().int().min(0, 'Cannot be negative'),
  })
  .superRefine((data, ctx) => {
    if (data.historicalAttended > data.historicalConducted) {
      ctx.addIssue({
        code: 'custom',
        path: ['historicalAttended'],
        message: 'Attended classes cannot exceed conducted classes',
      });
    }
  });

export type SubjectInput = z.infer<typeof subjectSchema>;

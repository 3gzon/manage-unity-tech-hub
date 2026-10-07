import { z } from 'zod';

export const guardianSchema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  relationship: z.enum(['MOTHER', 'FATHER', 'GUARDIAN', 'OTHER']),
});

export const studentSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']).optional(),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.string().optional(),
  school: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'PAUSED', 'GRADUATED']).default('ACTIVE'),
  registrationDate: z.string().optional(),
  guardians: z.array(guardianSchema).optional(),
});

export type StudentFormValues = z.infer<typeof studentSchema>;

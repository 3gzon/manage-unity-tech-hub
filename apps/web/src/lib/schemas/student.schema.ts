import { z } from 'zod';

function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return false;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function todayInputDate() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function asText<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((value) => (value == null ? '' : value), schema);
}

const optionalPhone = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || /^[0-9+()\-\s]{6,20}$/.test(value),
    'Enter a valid phone number with at least 6 digits',
  );

const optionalEmail = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || z.string().email().safeParse(value).success,
    'Enter a valid email address, such as name@example.com',
  );

export const guardianSchema = z.object({
  firstName: asText(z.string().trim().min(1, 'Guardian first name is required')),
  lastName: asText(z.string().trim().min(1, 'Guardian last name is required')),
  phone: asText(optionalPhone),
  email: asText(optionalEmail),
  relationship: z.enum(['MOTHER', 'FATHER', 'GUARDIAN', 'OTHER'], {
    errorMap: () => ({ message: 'Select the guardian relationship' }),
  }),
});

const optionalAge = z.preprocess((value) => {
  if (value === '' || value === null || value === undefined) return undefined;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}, z.number({ invalid_type_error: 'Age must be a whole number from 1 to 120' }).int('Age must be a whole number from 1 to 120').min(1, 'Age must be at least 1').max(120, 'Age must be 120 or less').optional());

export const studentSchema = z.object({
  firstName: asText(
    z.string().trim().min(1, 'First name is required').max(80, 'First name must be 80 characters or fewer'),
  ),
  lastName: asText(
    z.string().trim().min(1, 'Last name is required').max(80, 'Last name must be 80 characters or fewer'),
  ),
  dateOfBirth: asText(
    z
      .string()
      .trim()
      .refine((value) => value === '' || isCalendarDate(value), 'Enter a valid date of birth')
      .refine((value) => value === '' || value <= todayInputDate(), 'Date of birth cannot be in the future'),
  ),
  age: optionalAge,
  gender: z.preprocess(
    (value) => (value === '' || value === undefined || value === null ? undefined : value),
    z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']).optional(),
  ),
  phone: asText(optionalPhone),
  email: asText(optionalEmail),
  address: asText(z.string().trim().max(200, 'Address must be 200 characters or fewer')),
  school: asText(z.string().trim().max(120, 'School must be 120 characters or fewer')),
  notes: asText(z.string().trim().max(1000, 'Notes must be 1000 characters or fewer')),
  instructorId: z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? undefined : value),
    z.string().uuid('Select an instructor from the list').optional(),
  ),
  status: z.enum(['ACTIVE', 'INACTIVE', 'PAUSED', 'GRADUATED'], {
    errorMap: () => ({ message: 'Select a status' }),
  }),
  registrationDate: asText(
    z
      .string()
      .trim()
      .min(1, 'Registration date is required')
      .refine((value) => isCalendarDate(value), 'Enter a valid registration date'),
  ),
  guardians: z.array(guardianSchema).optional(),
});

export type StudentFormValues = z.infer<typeof studentSchema>;

export function toStudentRequest(values: StudentFormValues) {
  const blank = (value?: string) => value || undefined;
  return {
    ...values,
    dateOfBirth: blank(values.dateOfBirth),
    phone: blank(values.phone),
    email: blank(values.email),
    address: blank(values.address),
    school: blank(values.school),
    notes: blank(values.notes),
    guardians: values.guardians?.map((guardian) => ({
      ...guardian,
      phone: blank(guardian.phone),
      email: blank(guardian.email),
    })),
  };
}

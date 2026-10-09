'use client';

import { useEffect } from 'react';
import { useForm, useFieldArray, type FieldPath } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { StudentFormValues } from '@/lib/schemas/student.schema';
import { studentSchema } from '@/lib/schemas/student.schema';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface StudentFormProps {
  defaultValues?: Partial<StudentFormValues>;
  instructors?: Array<{ id: string; name: string }>;
  onSubmit: (values: StudentFormValues) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}

function todayInputDate() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function RequiredMark() {
  return (
    <span className="text-red-600" aria-hidden="true">
      {' '}
      *
    </span>
  );
}

export function StudentForm({
  defaultValues,
  instructors = [],
  onSubmit,
  onCancel,
  submitLabel = 'Save student',
}: StudentFormProps) {
  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      status: 'ACTIVE',
      registrationDate: todayInputDate(),
      guardians: [],
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      phone: '',
      email: '',
      address: '',
      school: '',
      notes: '',
      ...defaultValues,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'guardians',
  });

  useEffect(() => {
    void form.trigger();
  }, [form, fields.length]);

  const errors = form.formState.errors;
  const canSubmit = form.formState.isValid && !form.formState.isSubmitting;

  function errorFor(name: FieldPath<StudentFormValues>) {
    const error = form.getFieldState(name, form.formState).error;
    return error?.message;
  }

  function invalid(name: FieldPath<StudentFormValues>) {
    return Boolean(errorFor(name));
  }

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <p className="text-sm text-muted-foreground">Fields marked with * are required.</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <Label htmlFor="firstName">
            First name
            <RequiredMark />
          </Label>
          <Input
            id="firstName"
            autoComplete="given-name"
            required
            aria-invalid={invalid('firstName')}
            aria-describedby={invalid('firstName') ? 'firstName-error' : undefined}
            className={cn(invalid('firstName') && 'border-red-500')}
            {...form.register('firstName')}
          />
          {errors.firstName ? (
            <p id="firstName-error" className="mt-1 text-xs text-red-600" role="alert">
              {errors.firstName.message}
            </p>
          ) : null}
        </div>
        <div className="min-w-0">
          <Label htmlFor="lastName">
            Last name
            <RequiredMark />
          </Label>
          <Input
            id="lastName"
            autoComplete="family-name"
            required
            aria-invalid={invalid('lastName')}
            aria-describedby={invalid('lastName') ? 'lastName-error' : undefined}
            className={cn(invalid('lastName') && 'border-red-500')}
            {...form.register('lastName')}
          />
          {errors.lastName ? (
            <p id="lastName-error" className="mt-1 text-xs text-red-600" role="alert">
              {errors.lastName.message}
            </p>
          ) : null}
        </div>
        <div className="min-w-0">
          <Label htmlFor="age">Age</Label>
          <Input
            id="age"
            type="number"
            inputMode="numeric"
            min={1}
            max={120}
            aria-invalid={invalid('age')}
            aria-describedby={invalid('age') ? 'age-error' : undefined}
            className={cn(invalid('age') && 'border-red-500')}
            {...form.register('age')}
          />
          {errors.age ? (
            <p id="age-error" className="mt-1 text-xs text-red-600" role="alert">
              {errors.age.message}
            </p>
          ) : null}
        </div>
        <div className="min-w-0">
          <Label htmlFor="dateOfBirth">Date of birth</Label>
          <Input
            id="dateOfBirth"
            className={cn('min-w-0', invalid('dateOfBirth') && 'border-red-500')}
            type="date"
            max={todayInputDate()}
            aria-invalid={invalid('dateOfBirth')}
            aria-describedby={invalid('dateOfBirth') ? 'dateOfBirth-error' : undefined}
            {...form.register('dateOfBirth')}
          />
          {errors.dateOfBirth ? (
            <p id="dateOfBirth-error" className="mt-1 text-xs text-red-600" role="alert">
              {errors.dateOfBirth.message}
            </p>
          ) : null}
        </div>
        <div className="min-w-0">
          <Label htmlFor="gender">Gender</Label>
          <Select id="gender" {...form.register('gender')}>
            <option value="">Select</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
            <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
          </Select>
        </div>
        <div className="min-w-0">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            inputMode="tel"
            aria-invalid={invalid('phone')}
            aria-describedby={invalid('phone') ? 'phone-error' : undefined}
            className={cn(invalid('phone') && 'border-red-500')}
            {...form.register('phone')}
          />
          {errors.phone ? (
            <p id="phone-error" className="mt-1 text-xs text-red-600" role="alert">
              {errors.phone.message}
            </p>
          ) : null}
        </div>
        <div className="min-w-0">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            aria-invalid={invalid('email')}
            aria-describedby={invalid('email') ? 'email-error' : undefined}
            className={cn(invalid('email') && 'border-red-500')}
            {...form.register('email')}
          />
          {errors.email ? (
            <p id="email-error" className="mt-1 text-xs text-red-600" role="alert">
              {errors.email.message}
            </p>
          ) : null}
        </div>
        <div className="min-w-0">
          <Label htmlFor="school">School</Label>
          <Input
            id="school"
            aria-invalid={invalid('school')}
            className={cn(invalid('school') && 'border-red-500')}
            {...form.register('school')}
          />
          {errors.school ? (
            <p className="mt-1 text-xs text-red-600" role="alert">
              {errors.school.message}
            </p>
          ) : null}
        </div>
        <div className="min-w-0">
          <Label htmlFor="instructorId">Instructor</Label>
          <Select id="instructorId" {...form.register('instructorId')}>
            <option value="">No instructor</option>
            {instructors.map((instructor) => (
              <option key={instructor.id} value={instructor.id}>
                {instructor.name}
              </option>
            ))}
          </Select>
          {errors.instructorId ? (
            <p className="mt-1 text-xs text-red-600" role="alert">
              {errors.instructorId.message}
            </p>
          ) : null}
        </div>
        <div className="min-w-0">
          <Label htmlFor="status">
            Status
            <RequiredMark />
          </Label>
          <Select id="status" required aria-invalid={invalid('status')} {...form.register('status')}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="PAUSED">Paused</option>
            <option value="GRADUATED">Graduated</option>
          </Select>
          {errors.status ? (
            <p className="mt-1 text-xs text-red-600" role="alert">
              {errors.status.message}
            </p>
          ) : null}
        </div>
        <div className="min-w-0">
          <Label htmlFor="registrationDate">
            Registration date
            <RequiredMark />
          </Label>
          <Input
            id="registrationDate"
            className={cn('min-w-0', invalid('registrationDate') && 'border-red-500')}
            type="date"
            required
            aria-invalid={invalid('registrationDate')}
            aria-describedby={invalid('registrationDate') ? 'registrationDate-error' : undefined}
            {...form.register('registrationDate')}
          />
          {errors.registrationDate ? (
            <p id="registrationDate-error" className="mt-1 text-xs text-red-600" role="alert">
              {errors.registrationDate.message}
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <Label htmlFor="address">Address</Label>
        <Input
          id="address"
          aria-invalid={invalid('address')}
          className={cn(invalid('address') && 'border-red-500')}
          {...form.register('address')}
        />
        {errors.address ? (
          <p className="mt-1 text-xs text-red-600" role="alert">
            {errors.address.message}
          </p>
        ) : null}
      </div>

      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          aria-invalid={invalid('notes')}
          className={cn(invalid('notes') && 'border-red-500')}
          {...form.register('notes')}
        />
        {errors.notes ? (
          <p className="mt-1 text-xs text-red-600" role="alert">
            {errors.notes.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label>Guardians</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              append({ firstName: '', lastName: '', relationship: 'GUARDIAN', phone: '', email: '' })
            }
          >
            Add guardian
          </Button>
        </div>
        {fields.map((field, index) => {
          const guardianErrors = errors.guardians?.[index];
          return (
            <div key={field.id} className="grid grid-cols-1 gap-3 rounded-lg border p-3 sm:grid-cols-2">
              <div>
                <Label htmlFor={`guardian-${index}-firstName`}>
                  First name
                  <RequiredMark />
                </Label>
                <Input
                  id={`guardian-${index}-firstName`}
                  aria-invalid={Boolean(guardianErrors?.firstName)}
                  className={cn(guardianErrors?.firstName && 'border-red-500')}
                  {...form.register(`guardians.${index}.firstName`)}
                />
                {guardianErrors?.firstName ? (
                  <p className="mt-1 text-xs text-red-600" role="alert">
                    {guardianErrors.firstName.message}
                  </p>
                ) : null}
              </div>
              <div>
                <Label htmlFor={`guardian-${index}-lastName`}>
                  Last name
                  <RequiredMark />
                </Label>
                <Input
                  id={`guardian-${index}-lastName`}
                  aria-invalid={Boolean(guardianErrors?.lastName)}
                  className={cn(guardianErrors?.lastName && 'border-red-500')}
                  {...form.register(`guardians.${index}.lastName`)}
                />
                {guardianErrors?.lastName ? (
                  <p className="mt-1 text-xs text-red-600" role="alert">
                    {guardianErrors.lastName.message}
                  </p>
                ) : null}
              </div>
              <div>
                <Label htmlFor={`guardian-${index}-phone`}>Phone</Label>
                <Input
                  id={`guardian-${index}-phone`}
                  inputMode="tel"
                  aria-invalid={Boolean(guardianErrors?.phone)}
                  className={cn(guardianErrors?.phone && 'border-red-500')}
                  {...form.register(`guardians.${index}.phone`)}
                />
                {guardianErrors?.phone ? (
                  <p className="mt-1 text-xs text-red-600" role="alert">
                    {guardianErrors.phone.message}
                  </p>
                ) : null}
              </div>
              <div>
                <Label htmlFor={`guardian-${index}-email`}>Email</Label>
                <Input
                  id={`guardian-${index}-email`}
                  type="email"
                  aria-invalid={Boolean(guardianErrors?.email)}
                  className={cn(guardianErrors?.email && 'border-red-500')}
                  {...form.register(`guardians.${index}.email`)}
                />
                {guardianErrors?.email ? (
                  <p className="mt-1 text-xs text-red-600" role="alert">
                    {guardianErrors.email.message}
                  </p>
                ) : null}
              </div>
              <div>
                <Label htmlFor={`guardian-${index}-relationship`}>Relationship</Label>
                <Select id={`guardian-${index}-relationship`} {...form.register(`guardians.${index}.relationship`)}>
                  <option value="MOTHER">Mother</option>
                  <option value="FATHER">Father</option>
                  <option value="GUARDIAN">Guardian</option>
                  <option value="OTHER">Other</option>
                </Select>
                {guardianErrors?.relationship ? (
                  <p className="mt-1 text-xs text-red-600" role="alert">
                    {guardianErrors.relationship.message}
                  </p>
                ) : null}
              </div>
              <div className="flex items-end">
                <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                  Remove
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {!canSubmit && !form.formState.isSubmitting ? (
        <p className="text-sm text-red-600" role="status">
          Fix the errors above before saving this student.
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="w-full sm:w-auto" disabled={!canSubmit}>
          {form.formState.isSubmitting ? 'Saving...' : submitLabel}
        </Button>
      </div>
    </form>
  );
}

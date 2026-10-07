'use client';

import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { StudentFormValues } from '@/lib/schemas/student.schema';
import { studentSchema } from '@/lib/schemas/student.schema';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/input';

interface StudentFormProps {
  defaultValues?: Partial<StudentFormValues>;
  onSubmit: (values: StudentFormValues) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}

export function StudentForm({
  defaultValues,
  onSubmit,
  onCancel,
  submitLabel = 'Save student',
}: StudentFormProps) {
  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      status: 'ACTIVE',
      guardians: [],
      ...defaultValues,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'guardians',
  });

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="firstName">First name</Label>
          <Input id="firstName" {...form.register('firstName')} />
          {form.formState.errors.firstName ? (
            <p className="mt-1 text-xs text-red-600">{form.formState.errors.firstName.message}</p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="lastName">Last name</Label>
          <Input id="lastName" {...form.register('lastName')} />
        </div>
        <div>
          <Label htmlFor="dateOfBirth">Date of birth</Label>
          <Input id="dateOfBirth" type="date" {...form.register('dateOfBirth')} />
        </div>
        <div>
          <Label htmlFor="gender">Gender</Label>
          <Select id="gender" {...form.register('gender')}>
            <option value="">Select</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
            <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" {...form.register('phone')} />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...form.register('email')} />
        </div>
        <div>
          <Label htmlFor="school">School</Label>
          <Input id="school" {...form.register('school')} />
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <Select id="status" {...form.register('status')}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="PAUSED">Paused</option>
            <option value="GRADUATED">Graduated</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="registrationDate">Registration date</Label>
          <Input id="registrationDate" type="date" {...form.register('registrationDate')} />
        </div>
      </div>

      <div>
        <Label htmlFor="address">Address</Label>
        <Input id="address" {...form.register('address')} />
      </div>

      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" {...form.register('notes')} />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
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
        {fields.map((field, index) => (
          <div key={field.id} className="grid gap-3 rounded-lg border p-3 md:grid-cols-2">
            <Input placeholder="First name" {...form.register(`guardians.${index}.firstName`)} />
            <Input placeholder="Last name" {...form.register(`guardians.${index}.lastName`)} />
            <Input placeholder="Phone" {...form.register(`guardians.${index}.phone`)} />
            <Input placeholder="Email" {...form.register(`guardians.${index}.email`)} />
            <Select {...form.register(`guardians.${index}.relationship`)}>
              <option value="MOTHER">Mother</option>
              <option value="FATHER">Father</option>
              <option value="GUARDIAN">Guardian</option>
              <option value="OTHER">Other</option>
            </Select>
            <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
              Remove
            </Button>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Saving...' : submitLabel}
        </Button>
      </div>
    </form>
  );
}

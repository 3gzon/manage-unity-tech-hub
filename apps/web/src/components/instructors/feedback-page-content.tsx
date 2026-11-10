'use client';

import { useCallback, useEffect, useState } from 'react';
import type { InstructorDetail, InstructorStudent } from '@unity/types';
import { fetchMyInstructor } from '@/lib/instructors-api';
import { useAuth } from '@/lib/auth/auth-context';
import { hasRole } from '@/lib/auth/authorization';
import { Button } from '@/components/ui/button';
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BulkFeedbackDialog } from '@/components/instructors/bulk-feedback-dialog';
import { FeedbackHistory } from '@/components/instructors/feedback-history';
import { InstructorFeedbackDialog } from '@/components/instructors/instructor-feedback-dialog';

export function FeedbackPageContent() {
  const { user } = useAuth();
  const isInstructor = hasRole(user, 'INSTRUCTOR', 'SUPER_ADMIN', 'BRANCH_ADMIN');
  const [instructor, setInstructor] = useState<InstructorDetail | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [feedbackStudent, setFeedbackStudent] = useState<InstructorStudent | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadInstructor = useCallback(async () => {
    try {
      setInstructor(await fetchMyInstructor());
    } catch {
      // not an instructor or not linked — hide the buttons
    }
  }, []);

  useEffect(() => {
    if (isInstructor) void loadInstructor();
  }, [isInstructor, loadInstructor]);

  const students = instructor?.students ?? [];

  function handleFeedbackDone(msg: string) {
    setNotice(msg);
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Feedback</h1>
          <p className="text-sm text-muted-foreground">Every report that was emailed to a student.</p>
        </div>
        {instructor && students.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
              New feedback
            </Button>
            <Button size="sm" onClick={() => setBulkOpen(true)}>
              Give feedback to all
            </Button>
          </div>
        ) : null}
      </div>

      {notice ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">{notice}</p>
      ) : null}

      <FeedbackHistory key={refreshKey} searchable />

      {instructor ? (
        <>
          <StudentPickerDialog
            students={students}
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            onSelect={(s) => {
              setPickerOpen(false);
              setFeedbackStudent(s);
            }}
          />

          <InstructorFeedbackDialog
            instructorId={instructor.id}
            student={feedbackStudent}
            open={feedbackStudent !== null}
            onOpenChange={(open) => {
              if (!open) setFeedbackStudent(null);
            }}
            onSent={handleFeedbackDone}
          />

          <BulkFeedbackDialog
            instructorId={instructor.id}
            students={students}
            open={bulkOpen}
            onOpenChange={setBulkOpen}
            onDone={handleFeedbackDone}
          />
        </>
      ) : null}
    </div>
  );
}

function StudentPickerDialog({
  students,
  open,
  onOpenChange,
  onSelect,
}: {
  students: InstructorStudent[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (student: InstructorStudent) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Select a student</DialogTitle>
        <DialogDescription>Choose the student you want to give feedback to.</DialogDescription>
      </DialogHeader>
      <div className="max-h-72 space-y-1 overflow-y-auto">
        {students.map((student) => (
          <button
            key={student.enrollmentId}
            type="button"
            className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
            onClick={() => onSelect(student)}
          >
            <div>
              <p className="font-medium">{student.studentName}</p>
              <p className="text-xs text-muted-foreground">
                {student.courseName} · {student.groupName}
              </p>
            </div>
            {student.email ? (
              <span className="text-xs text-muted-foreground">{student.email}</span>
            ) : null}
          </button>
        ))}
      </div>
    </Dialog>
  );
}

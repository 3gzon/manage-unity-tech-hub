'use client';

import { FeedbackHistory } from '@/components/instructors/feedback-history';

export function FeedbackPageContent() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Feedback</h1>
        <p className="text-sm text-muted-foreground">Every report that was emailed to a student.</p>
      </div>
      <FeedbackHistory searchable />
    </div>
  );
}

-- Track first attendance submission on a session
ALTER TABLE "class_sessions"
  ADD COLUMN "attendance_submitted_at" TIMESTAMP(3);

-- Prevent duplicate sessions for the same group/date/time slot
CREATE UNIQUE INDEX "class_sessions_group_id_session_date_start_time_key"
  ON "class_sessions"("group_id", "session_date", "start_time");

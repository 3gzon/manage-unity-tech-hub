ALTER TABLE "audit_logs"
    ADD COLUMN "user_agent" TEXT;

CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

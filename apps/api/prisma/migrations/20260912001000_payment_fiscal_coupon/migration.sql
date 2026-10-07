ALTER TABLE "payments" ADD COLUMN "fiscal_coupon" TEXT;

CREATE UNIQUE INDEX "payments_fiscal_coupon_key" ON "payments"("fiscal_coupon");

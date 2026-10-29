-- CreateTable
CREATE TABLE "time_clock_pay_periods" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_clock_pay_periods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "time_clock_pay_periods_userId_startsAt_idx" ON "time_clock_pay_periods"("userId", "startsAt");

-- AddForeignKey
ALTER TABLE "time_clock_pay_periods" ADD CONSTRAINT "time_clock_pay_periods_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "time_clock_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clockInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clockOutAt" TIMESTAMP(3),
    "clockInIp" TEXT,
    "clockOutIp" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_clock_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "time_clock_entries_userId_clockInAt_idx" ON "time_clock_entries"("userId", "clockInAt");

-- CreateIndex
-- Partial unique index: at most one open (not yet clocked out) entry per user.
-- Prisma's schema language cannot express a filtered index, so it lives here only.
CREATE UNIQUE INDEX "time_clock_entries_open_unique" ON "time_clock_entries"("userId") WHERE "clockOutAt" IS NULL;

-- AddForeignKey
ALTER TABLE "time_clock_entries" ADD CONSTRAINT "time_clock_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

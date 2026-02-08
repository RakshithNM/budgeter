-- CreateEnum
CREATE TYPE "RecurrenceInterval" AS ENUM ('WEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "Spend" (
    "id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "notes" TEXT,
    "spentAt" TIMESTAMP(3) NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Spend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringSpend" (
    "id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "notes" TEXT,
    "interval" "RecurrenceInterval" NOT NULL,
    "dayOfWeek" INTEGER,
    "dayOfMonth" INTEGER,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringSpend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Spend_spentAt_idx" ON "Spend"("spentAt");

-- CreateIndex
CREATE INDEX "Spend_categoryId_idx" ON "Spend"("categoryId");

-- CreateIndex
CREATE INDEX "RecurringSpend_categoryId_idx" ON "RecurringSpend"("categoryId");

-- AddForeignKey
ALTER TABLE "Spend" ADD CONSTRAINT "Spend_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringSpend" ADD CONSTRAINT "RecurringSpend_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

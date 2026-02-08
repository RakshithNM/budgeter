/*
  Warnings:

  - You are about to drop the `RecurringSpend` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "RecurringSpend" DROP CONSTRAINT "RecurringSpend_categoryId_fkey";

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "recurring" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Spend" ADD COLUMN     "recurring" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "RecurringSpend";

-- DropEnum
DROP TYPE "RecurrenceInterval";

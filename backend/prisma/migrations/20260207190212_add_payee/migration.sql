-- AlterTable
ALTER TABLE "Spend" ADD COLUMN     "payeeName" TEXT;

-- CreateTable
CREATE TABLE "PayeeRule" (
    "id" TEXT NOT NULL,
    "matchText" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayeeRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayeeRename" (
    "id" TEXT NOT NULL,
    "matchText" TEXT NOT NULL,
    "renameTo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayeeRename_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayeeRule_categoryId_idx" ON "PayeeRule"("categoryId");

-- AddForeignKey
ALTER TABLE "PayeeRule" ADD CONSTRAINT "PayeeRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

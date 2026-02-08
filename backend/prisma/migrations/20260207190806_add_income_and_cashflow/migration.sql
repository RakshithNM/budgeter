-- CreateTable
CREATE TABLE "Income" (
    "id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "notes" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Income_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Income_receivedAt_idx" ON "Income"("receivedAt");

-- CreateTable
CREATE TABLE "ContestPayment" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "stripeSessionId" TEXT,
    "paidAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContestPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContestPayment_stripeSessionId_key" ON "ContestPayment"("stripeSessionId");

-- CreateIndex
CREATE INDEX "ContestPayment_contestId_status_idx" ON "ContestPayment"("contestId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ContestPayment_contestId_kind_key" ON "ContestPayment"("contestId", "kind");

-- AddForeignKey
ALTER TABLE "ContestPayment" ADD CONSTRAINT "ContestPayment_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

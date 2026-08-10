-- CreateTable
CREATE TABLE "ContestStage" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContestStage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContestStage_contestId_idx" ON "ContestStage"("contestId");

-- CreateIndex
CREATE UNIQUE INDEX "ContestStage_contestId_order_key" ON "ContestStage"("contestId", "order");

-- AddForeignKey
ALTER TABLE "ContestStage" ADD CONSTRAINT "ContestStage_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

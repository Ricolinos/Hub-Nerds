-- AlterTable
ALTER TABLE "Contest" ADD COLUMN     "prizeDescription" TEXT,
ADD COLUMN     "prizeFeePct" INTEGER,
ADD COLUMN     "prizeType" TEXT NOT NULL DEFAULT 'MONETARY',
ADD COLUMN     "responsibilityAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "responsibilityVersion" TEXT;

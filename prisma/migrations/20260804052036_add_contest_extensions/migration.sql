-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'CONTEST_EXTENDED';

-- AlterTable
ALTER TABLE "Contest" ADD COLUMN     "extensionsCount" INTEGER NOT NULL DEFAULT 0;

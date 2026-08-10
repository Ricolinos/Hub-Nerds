-- CreateTable
CREATE TABLE "PieceLike" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "pieceId" TEXT NOT NULL,

    CONSTRAINT "PieceLike_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PieceLike_pieceId_idx" ON "PieceLike"("pieceId");

-- CreateIndex
CREATE UNIQUE INDEX "PieceLike_userId_pieceId_key" ON "PieceLike"("userId", "pieceId");

-- AddForeignKey
ALTER TABLE "PieceLike" ADD CONSTRAINT "PieceLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PieceLike" ADD CONSTRAINT "PieceLike_pieceId_fkey" FOREIGN KEY ("pieceId") REFERENCES "PortfolioPiece"("id") ON DELETE CASCADE ON UPDATE CASCADE;

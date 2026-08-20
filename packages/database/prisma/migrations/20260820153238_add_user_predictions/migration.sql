-- CreateEnum
CREATE TYPE "UserPredictionStatus" AS ENUM ('OPEN', 'WON', 'LOST', 'VOID');

-- CreateTable
CREATE TABLE "user_predictions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fightId" TEXT NOT NULL,
    "pickedFighterId" TEXT NOT NULL,
    "status" "UserPredictionStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "user_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_predictions_fightId_idx" ON "user_predictions"("fightId");

-- CreateIndex
CREATE INDEX "user_predictions_userId_idx" ON "user_predictions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_predictions_userId_fightId_key" ON "user_predictions"("userId", "fightId");

-- AddForeignKey
ALTER TABLE "user_predictions" ADD CONSTRAINT "user_predictions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_predictions" ADD CONSTRAINT "user_predictions_fightId_fkey" FOREIGN KEY ("fightId") REFERENCES "fights"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_predictions" ADD CONSTRAINT "user_predictions_pickedFighterId_fkey" FOREIGN KEY ("pickedFighterId") REFERENCES "fighters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

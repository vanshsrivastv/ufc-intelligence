-- CreateTable
CREATE TABLE "elo_history" (
    "id" TEXT NOT NULL,
    "fighterId" TEXT NOT NULL,
    "fightId" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "eloAfter" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "elo_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "elo_history_fighterId_eventDate_idx" ON "elo_history"("fighterId", "eventDate");

-- CreateIndex
CREATE UNIQUE INDEX "elo_history_fighterId_fightId_key" ON "elo_history"("fighterId", "fightId");

-- AddForeignKey
ALTER TABLE "elo_history" ADD CONSTRAINT "elo_history_fighterId_fkey" FOREIGN KEY ("fighterId") REFERENCES "fighters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elo_history" ADD CONSTRAINT "elo_history_fightId_fkey" FOREIGN KEY ("fightId") REFERENCES "fights"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('UPCOMING', 'LIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "FightStatus" AS ENUM ('SCHEDULED', 'LIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FightMethod" AS ENUM ('KO', 'TKO', 'SUBMISSION', 'DECISION_UNANIMOUS', 'DECISION_SPLIT', 'DECISION_MAJORITY', 'DQ', 'NO_CONTEST', 'PENDING');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateTable
CREATE TABLE "weight_classes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weightLimitLbs" INTEGER NOT NULL,
    "isWomens" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "weight_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fighters" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nickname" TEXT,
    "dob" TIMESTAMP(3),
    "nationality" TEXT,
    "heightCm" INTEGER,
    "reachCm" INTEGER,
    "gym" TEXT,
    "coach" TEXT,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "noContests" INTEGER NOT NULL DEFAULT 0,
    "photoUrl" TEXT,
    "weightClassId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fighters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "venue" TEXT,
    "city" TEXT,
    "country" TEXT,
    "status" "EventStatus" NOT NULL DEFAULT 'UPCOMING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fights" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "weightClassId" TEXT,
    "fighterAId" TEXT NOT NULL,
    "fighterBId" TEXT NOT NULL,
    "isTitleFight" BOOLEAN NOT NULL DEFAULT false,
    "cardPosition" INTEGER NOT NULL DEFAULT 0,
    "status" "FightStatus" NOT NULL DEFAULT 'SCHEDULED',
    "method" "FightMethod" NOT NULL DEFAULT 'PENDING',
    "round" INTEGER,
    "time" TEXT,
    "winnerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fight_stats" (
    "id" TEXT NOT NULL,
    "fightId" TEXT NOT NULL,
    "fighterId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "sigStrikesLanded" INTEGER NOT NULL DEFAULT 0,
    "sigStrikesAttempted" INTEGER NOT NULL DEFAULT 0,
    "takedownsLanded" INTEGER NOT NULL DEFAULT 0,
    "takedownsAttempted" INTEGER NOT NULL DEFAULT 0,
    "controlTimeSeconds" INTEGER NOT NULL DEFAULT 0,
    "knockdowns" INTEGER NOT NULL DEFAULT 0,
    "submissionAttempts" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "fight_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rankings" (
    "id" TEXT NOT NULL,
    "weightClassId" TEXT NOT NULL,
    "fighterId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rankings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "predictions" (
    "id" TEXT NOT NULL,
    "fightId" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "winnerProbabilityA" DOUBLE PRECISION NOT NULL,
    "winnerProbabilityB" DOUBLE PRECISION NOT NULL,
    "koProbability" DOUBLE PRECISION NOT NULL,
    "subProbability" DOUBLE PRECISION NOT NULL,
    "decisionProbability" DOUBLE PRECISION NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "topFactors" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_favorites" (
    "userId" TEXT NOT NULL,
    "fighterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_favorites_pkey" PRIMARY KEY ("userId","fighterId")
);

-- CreateIndex
CREATE UNIQUE INDEX "weight_classes_name_key" ON "weight_classes"("name");

-- CreateIndex
CREATE UNIQUE INDEX "fighters_slug_key" ON "fighters"("slug");

-- CreateIndex
CREATE INDEX "fighters_weightClassId_idx" ON "fighters"("weightClassId");

-- CreateIndex
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");

-- CreateIndex
CREATE INDEX "events_date_idx" ON "events"("date");

-- CreateIndex
CREATE INDEX "fights_eventId_idx" ON "fights"("eventId");

-- CreateIndex
CREATE INDEX "fights_fighterAId_idx" ON "fights"("fighterAId");

-- CreateIndex
CREATE INDEX "fights_fighterBId_idx" ON "fights"("fighterBId");

-- CreateIndex
CREATE INDEX "fight_stats_fighterId_idx" ON "fight_stats"("fighterId");

-- CreateIndex
CREATE UNIQUE INDEX "fight_stats_fightId_fighterId_round_key" ON "fight_stats"("fightId", "fighterId", "round");

-- CreateIndex
CREATE INDEX "rankings_weightClassId_rank_idx" ON "rankings"("weightClassId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "rankings_weightClassId_fighterId_effectiveDate_key" ON "rankings"("weightClassId", "fighterId", "effectiveDate");

-- CreateIndex
CREATE INDEX "predictions_fightId_modelVersion_idx" ON "predictions"("fightId", "modelVersion");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "fighters" ADD CONSTRAINT "fighters_weightClassId_fkey" FOREIGN KEY ("weightClassId") REFERENCES "weight_classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fights" ADD CONSTRAINT "fights_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fights" ADD CONSTRAINT "fights_weightClassId_fkey" FOREIGN KEY ("weightClassId") REFERENCES "weight_classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fights" ADD CONSTRAINT "fights_fighterAId_fkey" FOREIGN KEY ("fighterAId") REFERENCES "fighters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fights" ADD CONSTRAINT "fights_fighterBId_fkey" FOREIGN KEY ("fighterBId") REFERENCES "fighters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fights" ADD CONSTRAINT "fights_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "fighters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fight_stats" ADD CONSTRAINT "fight_stats_fightId_fkey" FOREIGN KEY ("fightId") REFERENCES "fights"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fight_stats" ADD CONSTRAINT "fight_stats_fighterId_fkey" FOREIGN KEY ("fighterId") REFERENCES "fighters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rankings" ADD CONSTRAINT "rankings_weightClassId_fkey" FOREIGN KEY ("weightClassId") REFERENCES "weight_classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rankings" ADD CONSTRAINT "rankings_fighterId_fkey" FOREIGN KEY ("fighterId") REFERENCES "fighters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_fightId_fkey" FOREIGN KEY ("fightId") REFERENCES "fights"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_favorites" ADD CONSTRAINT "user_favorites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_favorites" ADD CONSTRAINT "user_favorites_fighterId_fkey" FOREIGN KEY ("fighterId") REFERENCES "fighters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

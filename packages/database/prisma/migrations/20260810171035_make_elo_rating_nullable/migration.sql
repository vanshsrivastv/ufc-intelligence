-- AlterTable
ALTER TABLE "fighters" ALTER COLUMN "eloRating" DROP NOT NULL,
ALTER COLUMN "eloRating" DROP DEFAULT;

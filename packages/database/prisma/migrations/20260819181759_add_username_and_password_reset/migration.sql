-- AlterTable: add username as nullable first - it can't be NOT NULL yet
-- because existing rows have no value for it. Backfilled below, then
-- locked down to NOT NULL + UNIQUE once every row has one.
ALTER TABLE "users" ADD COLUMN "username" TEXT;

-- Backfill: derive a username from the email's local part, deduplicated
-- with a short suffix from the row's own id so two users sharing an
-- email prefix (e.g. "vansh@gmail.com" and "vansh@work.com") don't
-- collide. Only ever touches existing rows at migration time - every
-- row created after this migration provides its own username at signup.
UPDATE "users"
SET "username" = lower(regexp_replace(split_part("email", '@', 1), '[^a-zA-Z0-9_]', '', 'g')) || '_' || substr("id", 1, 6)
WHERE "username" IS NULL;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

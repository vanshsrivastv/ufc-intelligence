-- CreateTable
CREATE TABLE "saved_comparisons" (
    "userId" TEXT NOT NULL,
    "fighterAId" TEXT NOT NULL,
    "fighterBId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_comparisons_pkey" PRIMARY KEY ("userId","fighterAId","fighterBId")
);

-- AddForeignKey
ALTER TABLE "saved_comparisons" ADD CONSTRAINT "saved_comparisons_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_comparisons" ADD CONSTRAINT "saved_comparisons_fighterAId_fkey" FOREIGN KEY ("fighterAId") REFERENCES "fighters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_comparisons" ADD CONSTRAINT "saved_comparisons_fighterBId_fkey" FOREIGN KEY ("fighterBId") REFERENCES "fighters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

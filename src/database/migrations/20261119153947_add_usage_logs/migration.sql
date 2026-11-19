-- CreateEnum
CREATE TYPE "UsageKind" AS ENUM ('EMBEDDING', 'CHAT_COMPLETION');

-- DropIndex
DROP INDEX "document_chunks_embedding_hnsw_idx";

-- CreateTable
CREATE TABLE "usage_logs" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "UsageKind" NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL,
    "costUsd" DECIMAL(12,6) NOT NULL,
    "documentId" UUID,
    "conversationId" UUID,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "usage_logs_userId_createdAt_idx" ON "usage_logs"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

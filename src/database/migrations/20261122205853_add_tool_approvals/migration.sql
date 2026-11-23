-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('COMPLETED', 'AWAITING_APPROVAL');

-- CreateEnum
CREATE TYPE "ToolApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "agentState" JSONB,
ADD COLUMN     "status" "MessageStatus" NOT NULL DEFAULT 'COMPLETED';

-- CreateTable
CREATE TABLE "tool_approvals" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "toolCallId" TEXT NOT NULL,
    "serverName" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "arguments" JSONB NOT NULL,
    "status" "ToolApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "autoApproved" BOOLEAN NOT NULL DEFAULT false,
    "decidedAt" TIMESTAMP(3),
    "result" TEXT,
    "error" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tool_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tool_approvals_userId_status_idx" ON "tool_approvals"("userId", "status");

-- CreateIndex
CREATE INDEX "tool_approvals_messageId_idx" ON "tool_approvals"("messageId");

-- CreateIndex
CREATE INDEX "tool_approvals_status_expiresAt_idx" ON "tool_approvals"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "tool_approvals" ADD CONSTRAINT "tool_approvals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_approvals" ADD CONSTRAINT "tool_approvals_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

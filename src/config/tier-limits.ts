import type { Tier } from '@/database/generated/prisma/client';

export const TIER_LIMITS = {
  FREE: { maxDocuments: 5, monthlyTokenBudget: 100_000 },
  PRO: { maxDocuments: 100, monthlyTokenBudget: 2_000_000 },
  ENTERPRISE: { maxDocuments: 1_000, monthlyTokenBudget: 20_000_000 },
} as const satisfies Record<Tier, { maxDocuments: number; monthlyTokenBudget: number }>;

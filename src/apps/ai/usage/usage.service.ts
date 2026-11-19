import { UsageKind } from '@/database/generated/prisma/enums';
import { calculateCostUsd } from './pricing';
import { usageRepository } from './usage.repository';
import { Cache } from '@/cache/cache.service';
import { cachePolicies } from '@/cache/cache.policies';
import { appEvents } from '@/events';
import { TIER_LIMITS } from '@/config/tier-limits';
import { AuthenticatedUser } from '@/types/express';

export interface RecordUsageInput {
  userId: string;
  kind: UsageKind;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens?: number;
  documentId?: string;
  conversationId?: string;
}

const startOfCurrentMonthUtc = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
};

export const usageService = {
  async recordUsage(input: RecordUsageInput) {
    const completionTokens = input.completionTokens ?? 0;
    const totalTokens = input.promptTokens + completionTokens;
    const costUsd = calculateCostUsd(input.model, input.promptTokens, completionTokens);

    await usageRepository.createUsageLog({
      ...input,
      completionTokens,
      totalTokens,
      costUsd,
    });
    await Cache.invalidateTags(...cachePolicies.monthlyUsage.tags(input.userId));
    appEvents.emit('usage.recorded', {
      userId: input.userId,
      kind: input.kind,
      provider: input.provider,
      model: input.model,
      totalTokens,
      costUsd,
    });
  },

  getMonthlyUsage(userId: string) {
    const policy = cachePolicies.monthlyUsage;
    return Cache.getOrSet(
      policy.key(userId),
      { ttlSeconds: policy.ttlSeconds, tags: policy.tags(userId) },
      () => usageRepository.getUsageSince(userId, startOfCurrentMonthUtc()),
    );
  },

  async getUsageSummary(user: AuthenticatedUser) {
    const usage = await usageService.getMonthlyUsage(user.id);
    const budget = TIER_LIMITS[user.tier].monthlyTokenBudget;
    return {
      ...usage,
      monthlyTokenBudget: budget,
      remainingTokens: Math.max(0, budget - usage.totalTokens),
    };
  },

  /** Checked before each chat turn.
   * Cached usage means a small overshoot is possible by design. */
  async assertWithinBudget(user: AuthenticatedUser) {
    const { totalTokens, monthlyTokenBudget } = await usageService.getUsageSummary(user);
    if (totalTokens >= monthlyTokenBudget) {
      throw new QuotaExceededError('Your monthly token budget has been used up', {
        used: totalTokens,
        budget: monthlyTokenBudget,
      });
    }
  },
};

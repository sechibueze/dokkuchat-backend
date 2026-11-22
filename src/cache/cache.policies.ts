const monthStamp = () => new Date().toISOString().slice(0, 7);

export const cachePolicies = {
  authenticatedUser: {
    ttlSeconds: 60,
    key: (userId: string) => `user:${userId}`,
    tags: (userId: string, roleId?: string) => [
      `user:${userId}`,
      ...(roleId ? [`role:${roleId}`] : []),
    ],
  },
  documentList: {
    ttlSeconds: 120,
    key: (userId: string, queryHash: string) => `documents:${userId}:list:${queryHash}`,
    tags: (userId: string) => [`user:${userId}:documents`],
  },
  documentDetail: {
    ttlSeconds: 300,
    key: (documentId: string) => `document:${documentId}`,
    tags: (documentId: string) => [`document:${documentId}`],
  },
  conversationList: {
    ttlSeconds: 60,
    key: (userId: string, queryHash: string) => `conversations:${userId}:list:${queryHash}`,
    tags: (userId: string) => [`user:${userId}:conversations`],
  },
  queryEmbedding: {
    ttlSeconds: 24 * 60 * 60,
    key: (provider: string, model: string, textHash: string) =>
      `embedding:${provider}:${model}:${textHash}`,
    tags: () => ['embeddings'],
  },
  monthlyUsage: {
    ttlSeconds: 30,
    key: (userId: string) => `usage:${userId}:${monthStamp()}`,
    tags: (userId: string) => [`user:${userId}:usage`],
  },
} as const;

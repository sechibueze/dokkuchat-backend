import { cachePolicies } from '@/cache/cache.policies';
import { Cache } from '@/cache/cache.service';

export const invalidateDocumentCaches = (userId: string, documentId?: string) =>
  Cache.invalidateTags(
    ...cachePolicies.documentList.tags(userId),
    ...(documentId ? cachePolicies.documentDetail.tags(documentId) : []),
  );

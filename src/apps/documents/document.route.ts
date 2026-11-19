import { Router } from 'express';
import { documentController } from './document.controller';
import { documentIdParamSchema, listDocumentsQuerySchema } from './document.schema';
import { uploadDocuments } from './upload.middleware';
import { authenticate } from '@/apps/auth/auth.middleware';
import { rateLimit, rateLimitPolicies } from '@/middlewares/rate-limit.middleware';
import { validateRequest } from '@/middlewares/validate.middleware';

export const documentRouter = Router();

documentRouter.use(authenticate);
documentRouter.post(
  '/',
  rateLimit(rateLimitPolicies.documentUpload),
  uploadDocuments,
  documentController.upload,
);
documentRouter.get(
  '/',
  validateRequest(listDocumentsQuerySchema, 'query'),
  documentController.list,
);
documentRouter.get(
  '/:id',
  validateRequest(documentIdParamSchema, 'params'),
  documentController.get,
);
documentRouter.get(
  '/:id/download-url',
  validateRequest(documentIdParamSchema, 'params'),
  documentController.getDownloadUrl,
);
documentRouter.post(
  '/:id/reprocess',
  validateRequest(documentIdParamSchema, 'params'),
  documentController.reprocess,
);
documentRouter.delete(
  '/:id',
  validateRequest(documentIdParamSchema, 'params'),
  documentController.remove,
);

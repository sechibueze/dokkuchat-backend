import type { Request, Response } from 'express';
import type { ListDocumentsQuery } from './document.schema';
import { documentService } from './document.service';
import { sendSuccess } from '@/utils/response';

export const documentController = {
  async upload(req: Request, res: Response) {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const result = await documentService.uploadDocuments(req.user!, files);
    sendSuccess(res, result, { status: result.documents.length > 0 ? 201 : 200 });
  },

  async list(req: Request, res: Response) {
    const { documents, meta } = await documentService.listDocuments(
      req.user!.id,
      req.query as unknown as ListDocumentsQuery,
    );
    sendSuccess(res, documents, { meta });
  },

  async get(req: Request, res: Response) {
    sendSuccess(res, await documentService.getDocument(req.user!.id, req.params.id as string));
  },

  async getDownloadUrl(req: Request, res: Response) {
    sendSuccess(res, await documentService.getDownloadUrl(req.user!.id, req.params.id as string));
  },

  async reprocess(req: Request, res: Response) {
    sendSuccess(
      res,
      await documentService.reprocessDocument(req.user!.id, req.params.id as string),
      { status: 202 },
    );
  },

  async remove(req: Request, res: Response) {
    await documentService.deleteDocument(req.user!.id, req.params.id as string);
    sendSuccess(res, { message: 'Document deleted' });
  },
};

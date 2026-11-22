import type { z } from 'zod';

export interface RouteDoc {
  method: 'get' | 'post' | 'patch' | 'delete';
  /** OpenAPI path relative to /api/v1, e.g. `/documents/{id}`. */
  path: string;
  tag: string;
  summary: string;
  description?: string;
  public?: boolean;
  permission?: string;
  limited?: boolean;
  params?: z.ZodObject;
  query?: z.ZodObject;
  body?: z.ZodType;
  multipart?: boolean;
  success: { status: number; description: string };
  unversioned?: boolean;
}

export const route = (doc: RouteDoc) => doc;

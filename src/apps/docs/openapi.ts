import { z } from 'zod';
import type { RouteDoc } from './route-docs';

type Json = Record<string, unknown>;

function toJsonSchema(schema: z.ZodType): Json {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema, {
    io: 'input',
    unrepresentable: 'any',
  }) as Json;
  return rest;
}

function toParameters(schema: z.ZodObject, location: 'query' | 'path') {
  const json = toJsonSchema(schema) as {
    properties?: Record<string, unknown>;
    required?: string[];
  };
  return Object.entries(json.properties ?? {}).map(([name, definition]) => ({
    name,
    in: location,
    required: location === 'path' || (json.required ?? []).includes(name),
    schema: definition,
  }));
}

const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
});

function buildOperation(doc: RouteDoc) {
  const parameters = [
    ...(doc.params ? toParameters(doc.params, 'path') : []),
    ...(doc.query ? toParameters(doc.query, 'query') : []),
  ];
  const requestBody = doc.multipart
    ? {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['files'],
              properties: {
                files: { type: 'array', maxItems: 5, items: { type: 'string', format: 'binary' } },
              },
            },
          },
        },
      }
    : doc.body
      ? { required: true, content: { 'application/json': { schema: toJsonSchema(doc.body) } } }
      : undefined;

  return {
    tags: [doc.tag],
    summary: doc.summary,
    description:
      [doc.description, doc.permission && `Requires permission \`${doc.permission}\`.`]
        .filter(Boolean)
        .join('\n\n') || undefined,
    security: doc.public ? [] : [{ bearerAuth: [] }],
    parameters: parameters.length > 0 ? parameters : undefined,
    requestBody,
    responses: {
      [doc.success.status]: {
        description: doc.success.description,
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/SuccessEnvelope' } },
        },
      },
      ...(!doc.public && { 401: errorResponse('Missing or invalid access token') }),
      ...(doc.permission && { 403: errorResponse('Missing permission') }),
      ...((doc.body || doc.query || doc.params) && { 422: errorResponse('Validation failed') }),
      ...(doc.limited && { 429: errorResponse('Rate limit exceeded') }),
    },
  };
}

export function buildOpenApiDocument(docs: RouteDoc[]) {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const doc of docs) {
    const fullPath = doc.unversioned ? doc.path : `/api/v1${doc.path}`;
    (paths[fullPath] ??= {})[doc.method] = buildOperation(doc);
  }
  return {
    openapi: '3.1.0',
    info: {
      title: 'Dokkuchat API',
      version: '1.0.0',
      description:
        'Ask questions about your own documents. Every response uses one envelope and carries a correlation id.',
    },
    servers: [{ url: '/' }],
    paths,
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      schemas: {
        SuccessEnvelope: {
          type: 'object',
          required: ['success', 'data'],
          properties: {
            success: { const: true },
            data: {},
            meta: { type: 'object' },
            correlationId: { type: 'string' },
          },
        },
        ErrorEnvelope: {
          type: 'object',
          required: ['success', 'error'],
          properties: {
            success: { const: false },
            error: {
              type: 'object',
              required: ['code', 'message'],
              properties: { code: { type: 'string' }, message: { type: 'string' }, details: {} },
            },
            correlationId: { type: 'string' },
          },
        },
      },
    },
  };
}

import type { z } from 'zod';

type ValidationResult = {
  success: boolean;
  issues?: Array<{
    path: string;
    message: string;
  }>;
  data?: unknown;
};

export function validateData<S extends z.ZodType>(
  schema: S,
  data: unknown,
): ValidationResult {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map((i) => ({
      path: i.path.map(String).join('.'),
      message: i.message,
    }));
    return { success: false, issues };
  }
  return { success: true, data: result.data };
}

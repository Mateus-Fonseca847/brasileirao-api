import type { z } from "zod";

import { HttpError } from "./errors.js";

export function validateRequest<TSchema extends z.ZodType>(
  schema: TSchema,
  value: unknown,
): z.infer<TSchema> {
  const result = schema.safeParse(value);

  if (!result.success) {
    const message =
      result.error.issues[0]?.message ?? "Invalid request parameters.";

    throw new HttpError(400, message);
  }

  return result.data;
}

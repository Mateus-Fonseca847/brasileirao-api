import { z } from "zod";

import { seasonYearSchema } from "../seasons/season.schemas.js";
import { teamSlugSchema } from "../teams/team.schemas.js";

function createPositiveIntegerQuerySchema(
  fieldName: string,
  defaultValue: number,
  maximum?: number,
) {
  const numberSchema = z
    .string()
    .regex(/^\d+$/, `${fieldName} must be a valid integer.`)
    .transform(Number)
    .pipe(
      z
        .number()
        .int(`${fieldName} must be a valid integer.`)
        .positive(`${fieldName} must be a positive integer.`),
    );

  const schema =
    maximum === undefined
      ? numberSchema
      : numberSchema.pipe(
        z
          .number()
          .max(maximum, `${fieldName} must be less than or equal to ${maximum}.`),
      );

  return z.preprocess(
    (value) => (value === undefined ? String(defaultValue) : value),
    schema,
  );
}

export const matchQuerySchema = z.object({
  season: seasonYearSchema.optional(),
  team: teamSlugSchema.optional(),
  round: z
    .string()
    .regex(/^\d+$/, "Round must be a valid integer.")
    .transform(Number)
    .pipe(
      z
        .number()
        .int("Round must be a valid integer.")
        .positive("Round must be a positive integer."),
    )
    .optional(),
  page: createPositiveIntegerQuerySchema("Page", 1),
  limit: createPositiveIntegerQuerySchema("Limit", 50, 100),
});

export const matchIdParamsSchema = z.object({
  id: z.string().uuid("Match id must be a valid UUID."),
});

export type MatchQuery = z.infer<typeof matchQuerySchema>;
export type MatchIdParams = z.infer<typeof matchIdParamsSchema>;

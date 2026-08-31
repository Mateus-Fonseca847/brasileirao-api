import { z } from "zod";

import { seasonYearSchema } from "../seasons/season.schemas.js";
import { teamSlugSchema } from "../teams/team.schemas.js";

export const matchQuerySchema = z.object({
  season: seasonYearSchema.optional(),
  team: teamSlugSchema.optional(),
  round: z
    .string()
    .regex(/^\d+$/, "Round must be a valid integer.")
    .transform(Number)
    .pipe(z.number().int("Round must be a valid integer.").positive("Round must be a positive integer."))
    .optional(),
});

export const matchIdParamsSchema = z.object({
  id: z.string().uuid("Match id must be a valid UUID."),
});

export type MatchQuery = z.infer<typeof matchQuerySchema>;
export type MatchIdParams = z.infer<typeof matchIdParamsSchema>;

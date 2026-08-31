import { z } from "zod";

export const seasonYearSchema = z
  .string()
  .regex(/^\d+$/, "Season year must be a valid integer.")
  .transform(Number)
  .pipe(
    z
      .number()
      .int("Season year must be a valid integer.")
      .min(2003, "Season year must be greater than or equal to 2003."),
  );

export const seasonYearParamsSchema = z.object({
  year: seasonYearSchema,
});

export type SeasonYearParams = z.infer<typeof seasonYearParamsSchema>;

import { z } from "zod";

export const teamSlugSchema = z
  .string()
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Team slug must be a lowercase kebab-case string.",
  );

export const teamSlugParamsSchema = z.object({
  slug: teamSlugSchema,
});

export type TeamSlugParams = z.infer<typeof teamSlugParamsSchema>;

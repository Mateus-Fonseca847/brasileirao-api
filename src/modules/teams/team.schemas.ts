import { z } from "zod";

export const teamSlugParamsSchema = z.object({
  slug: z
    .string()
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Team slug must be a lowercase kebab-case string.",
    ),
});

export type TeamSlugParams = z.infer<typeof teamSlugParamsSchema>;

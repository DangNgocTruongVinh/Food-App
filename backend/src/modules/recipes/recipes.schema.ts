import { z } from "zod";

const empty = z.object({});

export const listRecipesSchema = z.object({
  body: empty,
  params: empty,
  query: z.object({
    search: z.string().max(80).optional(),
    cuisine: z.string().max(50).optional(),
  }),
});

export const getRecipeSchema = z.object({
  body: empty,
  params: z.object({ id: z.string().cuid() }),
  query: empty,
});

export type RecipeListQuery = z.infer<typeof listRecipesSchema>["query"];
export type RecipeIdParams = z.infer<typeof getRecipeSchema>["params"];

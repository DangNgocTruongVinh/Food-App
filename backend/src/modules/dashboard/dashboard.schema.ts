import { z } from "zod";

const empty = z.object({});

export const getDashboardSchema = z.object({
  body: empty,
  params: empty,
  query: empty,
});

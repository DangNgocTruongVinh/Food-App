import { z } from "zod";

export const loginSchema = z.object({
  body: z.object({ email: z.string().email(), password: z.string().min(8).max(72) }),
  params: z.object({}),
  query: z.object({}),
});

export const registerSchema = loginSchema.extend({
  body: loginSchema.shape.body.extend({ name: z.string().min(2).max(80) }),
});

export type LoginInput = z.infer<typeof loginSchema>["body"];
export type RegisterInput = z.infer<typeof registerSchema>["body"];

import type { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { accountLockedError } from "../../middleware/auth.js";
import { HttpError } from "../../utils/http-error.js";
import type { LoginInput, RegisterInput } from "./auth.schema.js";

function issueToken(user: { id: string; email: string }) {
  return jwt.sign({ sub: user.id, email: user.email }, env.JWT_SECRET, { expiresIn: "7d" });
}

const publicUser = (user: { id: string; email: string; name: string; role: Role }) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
});

export async function register(input: RegisterInput) {
  const email = input.email.trim().toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) {
    throw new HttpError(409, "Email này đã được sử dụng.");
  }
  const user = await prisma.user.create({
    data: {
      email,
      name: input.name.trim(),
      passwordHash: await bcrypt.hash(input.password, 12),
      profile: { create: {} },
    },
  });
  return { token: issueToken(user), user: publicUser(user) };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email.trim().toLowerCase() } });
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new HttpError(401, "Email hoặc mật khẩu không đúng.");
  }
  // Kiểm tra mật khẩu trước: người không biết mật khẩu không dò được tài khoản nào đang bị khóa.
  if (user.lockedAt) throw accountLockedError();
  return { token: issueToken(user), user: publicUser(user) };
}

import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";
import profileRoutes from "./profile.routes.js";
import { request, testApp } from "../../test/http-test-utils.js";

const mocks = vi.hoisted(() => ({
  secret: "nouri-test-only-secret-at-least-32-characters",
  findUser: vi.fn(), findProfile: vi.fn(), updateUser: vi.fn(), upsertProfile: vi.fn(), transaction: vi.fn(),
}));
vi.mock("../../config/env.js", () => ({ env: { JWT_SECRET: mocks.secret } }));
vi.mock("../../lib/prisma.js", () => ({ prisma: {
  user: { findUnique: mocks.findUser, update: mocks.updateUser },
  nutritionProfile: { findUnique: mocks.findProfile, upsert: mocks.upsertProfile }, $transaction: mocks.transaction,
} }));
const app = testApp("/api/profile", profileRoutes);
const user = { id: "user-a", email: "demo@nouri.vn", name: "Minh Anh" };
const token = () => `Bearer ${jwt.sign({ sub: user.id, email: user.email }, mocks.secret)}`;
const profileInput = {
  age: 25, gender: "FEMALE", heightCm: 165, weightKg: 60, targetWeightKg: 55,
  activityLevel: "MODERATE", goal: "MAINTAIN", dietType: "BALANCED", mealsPerDay: 3,
  allergies: [], dislikedFoods: ["Cần tây"], preferredCuisines: ["Việt Nam"],
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.findProfile.mockResolvedValue(profileInput);
  mocks.updateUser.mockResolvedValue(user);
  mocks.upsertProfile.mockImplementation(async ({ update }) => ({ id: "profile-a", userId: user.id, ...update }));
  mocks.transaction.mockImplementation((operation) => operation({
    user: { update: mocks.updateUser },
    nutritionProfile: { findUnique: mocks.findProfile, upsert: mocks.upsertProfile },
  }));
});

describe("Profile HTTP contract (no database)", () => {
  it("gets the authenticated user's profile, ignoring a userId query parameter", async () => {
    const result = { ...user, profile: { ...profileInput, createdAt: new Date("2026-09-12T00:00:00Z") } };
    mocks.findUser.mockResolvedValue(result);
    expect(await request(app, "/api/profile?userId=user-b", { token: token() }))
      .toEqual({ status: 200, body: JSON.parse(JSON.stringify(result)) });
    expect(mocks.findUser).toHaveBeenCalledWith({ where: { id: user.id }, select: { id: true, name: true, email: true, role: true, profile: true } });
  });

  it("preserves the current 200/null response for a missing user", async () => {
    mocks.findUser.mockResolvedValue(null);
    expect(await request(app, "/api/profile", { token: token() })).toEqual({ status: 200, body: null });
  });

  it("updates only the token owner's records in one transaction, preserving calculated targets", async () => {
    const response = await request(app, "/api/profile", {
      method: "PUT", token: token(), body: { name: "Tên mới", ...profileInput, userId: "user-b", dailyCalorieTarget: 9999 },
    });
    expect(response.status).toBe(200);
    expect(mocks.updateUser).toHaveBeenCalledWith({ where: { id: user.id }, data: { name: "Tên mới" }, select: { id: true, name: true, email: true, role: true } });
    const saved = { ...profileInput, dailyCalorieTarget: 2085, proteinTargetG: 130, carbTargetG: 245, fatTargetG: 65 };
    expect(mocks.upsertProfile).toHaveBeenCalledWith({ where: { userId: user.id }, create: { userId: user.id, ...saved }, update: saved });
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(response.body).toEqual({ ...user, profile: { id: "profile-a", userId: user.id, ...saved } });
  });

  it("merges the stored profile before recalculating targets for a partial payload", async () => {
    await request(app, "/api/profile", { method: "PUT", token: token(), body: { name: "Tên mới" } });
    expect(mocks.findProfile).toHaveBeenCalledWith({ where: { userId: user.id } });
    expect(mocks.upsertProfile.mock.calls[0][0].update).toEqual({ dailyCalorieTarget: 2085, proteinTargetG: 130, carbTargetG: 245, fatTargetG: 65 });
  });

  it("lets submitted profile fields override stored values during recalculation", async () => {
    await request(app, "/api/profile", { method: "PUT", token: token(), body: { goal: "BUILD_MUSCLE" } });
    expect(mocks.upsertProfile.mock.calls[0][0].update).toEqual({
      goal: "BUILD_MUSCLE", dailyCalorieTarget: 2385, proteinTargetG: 179, carbTargetG: 250, fatTargetG: 74,
    });
  });

  it("retains explicit nulls and empty arrays; an omitted name does not overwrite the user", async () => {
    const body = { age: null, gender: null, heightCm: null, weightKg: null, targetWeightKg: null, allergies: [], dislikedFoods: [], preferredCuisines: [] };
    const response = await request(app, "/api/profile", { method: "PUT", token: token(), body });
    expect(response.status).toBe(200);
    expect(mocks.updateUser.mock.calls[0][0].data).toEqual({});
    expect(mocks.upsertProfile.mock.calls[0][0].update).toMatchObject(body);
  });

  it.each([{ age: 12 }, { weightKg: 0 }, { mealsPerDay: 5 }, { allergies: "tôm" }, { gender: "UNKNOWN" }])("retains validation for %j", async (body) => {
    const response = await request(app, "/api/profile", { method: "PUT", token: token(), body });
    expect(response.status).toBe(422);
    expect(response.body.message).toBe("Dữ liệu gửi lên chưa hợp lệ.");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated update before touching Prisma", async () => {
    expect(await request(app, "/api/profile", { method: "PUT", body: profileInput }))
      .toEqual({ status: 401, body: { message: "Bạn cần đăng nhập để tiếp tục." } });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

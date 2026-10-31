import type { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import { createAppQueryClient } from "../../api/query-client";
import { queryKeys } from "../../api/query-keys";
import type { CommunityComment, CommunityPost } from "../../types";
import {
  addCommunityComment,
  listCommunityPosts,
  publishCommunityPost,
  toggleCommunityLike,
} from "./community.api";
import {
  COMMUNITY_COMMENT_MAX_LENGTH,
  COMMUNITY_POST_MAX_LENGTH,
  communityCommentInputId,
  communityInitials,
  communityPostElementId,
  communityShareRecipePath,
  communityShareText,
  COMMUNITY_RECIPE_PICKER_LIMIT,
  filterAttachableRecipes,
  normalizeSearchText,
  SHARE_RECIPE_PARAM,
  addCommunityImages,
  COMMUNITY_MAX_IMAGES,
  shareRecipeError,
  toCommunityPublishInput,
  toCommunityRecipeSummary,
  communityRelativeTime,
  featuredMembers,
  normalizeCommunityContent,
  shareCommunityPost,
  suggestedTopics,
  toggleCommunitySelection,
} from "./community.logic";
import {
  appendCommunityComment,
  communityQueries,
  prependCommunityPost,
  updateCommunityLike,
} from "./community.queries";

const author = { id: "user-a", name: "Linh Nhi" };
const comment: CommunityComment = {
  id: "comment-a",
  content: "Rất hữu ích",
  createdAt: "2026-09-15T08:00:00.000Z",
  updatedAt: "2026-09-15T08:00:00.000Z",
  author: { id: "user-b", name: "Minh An" },
};
const post: CommunityPost = {
  id: "post-a",
  content: "Bữa trưa lành mạnh",
  createdAt: "2026-09-15T08:00:00.000Z",
  updatedAt: "2026-09-15T08:00:00.000Z",
  author,
  recipe: null,
  images: [],
  likedByMe: false,
  likeCount: 2,
  commentCount: 0,
  comments: [],
};

const recipeSummary = { id: "recipe-a", name: "Cá kho tộ (kèm cơm)", imageUrl: null, calories: 520, prepMinutes: 15, cookMinutes: 35 };

const originalAdapter = api.defaults.adapter;
let client: QueryClient;

beforeEach(() => {
  client = createAppQueryClient();
  vi.stubGlobal("localStorage", { getItem: () => null });
  vi.stubGlobal("sessionStorage", { getItem: () => null });
});

afterEach(() => {
  client.clear();
  api.defaults.adapter = originalAdapter;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Community API adapters (no network)", () => {
  it("uses the unchanged feed endpoint", async () => {
    const adapter = vi.fn(async (config) => ({
      config, data: [post], status: 200, statusText: "OK", headers: {},
    }));
    api.defaults.adapter = adapter;
    await expect(listCommunityPosts()).resolves.toEqual([post]);
    expect(adapter.mock.calls[0][0]).toMatchObject({ method: "get", url: "/community" });
    expect(adapter.mock.calls[0][0].params).toBeUndefined();
  });

  it("publishes through the unchanged endpoint and payload", async () => {
    const adapter = vi.fn(async (config) => ({
      config, data: post, status: 201, statusText: "Created", headers: {},
    }));
    api.defaults.adapter = adapter;
    await expect(publishCommunityPost({ content: post.content })).resolves.toEqual(post);
    expect(adapter.mock.calls[0][0]).toMatchObject({ method: "post", url: "/community" });
    expect(JSON.parse(adapter.mock.calls[0][0].data)).toEqual({ content: post.content });
  });

  it("sends recipeId only when a recipe is attached", async () => {
    const adapter = vi.fn(async (config) => ({ config, data: post, status: 201, statusText: "Created", headers: {} }));
    api.defaults.adapter = adapter;
    await publishCommunityPost({ content: "", recipeId: "recipe-a" });
    await publishCommunityPost({ content: "Bữa trưa", recipeId: undefined });
    expect(JSON.parse(adapter.mock.calls[0][0].data)).toEqual({ content: "", recipeId: "recipe-a" });
    expect(JSON.parse(adapter.mock.calls[1][0].data)).toEqual({ content: "Bữa trưa" });
  });

  it("toggles likes through the unchanged endpoint", async () => {
    const result = { liked: true, likeCount: 3 };
    const adapter = vi.fn(async (config) => ({
      config, data: result, status: 200, statusText: "OK", headers: {},
    }));
    api.defaults.adapter = adapter;
    await expect(toggleCommunityLike(post.id)).resolves.toEqual(result);
    expect(adapter.mock.calls[0][0]).toMatchObject({ method: "post", url: `/community/${post.id}/like` });
  });

  it("adds comments through the unchanged endpoint and payload", async () => {
    const adapter = vi.fn(async (config) => ({
      config, data: comment, status: 201, statusText: "Created", headers: {},
    }));
    api.defaults.adapter = adapter;
    await expect(addCommunityComment({ postId: post.id, content: comment.content })).resolves.toEqual(comment);
    expect(adapter.mock.calls[0][0]).toMatchObject({
      method: "post", url: `/community/${post.id}/comments`,
    });
    expect(JSON.parse(adapter.mock.calls[0][0].data)).toEqual({ content: comment.content });
  });

  it.each(["feed", "publish", "like", "comment"] as const)("propagates a failed %s request", async (operation) => {
    const failure = new Error(`${operation} failed`);
    api.defaults.adapter = async () => { throw failure; };
    const requests = {
      feed: () => listCommunityPosts(),
      publish: () => publishCommunityPost({ content: post.content }),
      like: () => toggleCommunityLike(post.id),
      comment: () => addCommunityComment({ postId: post.id, content: comment.content }),
    };
    await expect(requests[operation]()).rejects.toBe(failure);
  });
});

describe("Community query and cache definitions", () => {
  it("uses the shared feed key and caches responses", async () => {
    const adapter = vi.fn(async (config) => ({
      config, data: [post], status: 200, statusText: "OK", headers: {},
    }));
    api.defaults.adapter = adapter;
    expect(queryKeys.community.all).toEqual(["community"]);
    expect(communityQueries.feed().queryKey).toEqual(["community", "feed"]);
    await expect(client.fetchQuery(communityQueries.feed())).resolves.toEqual([post]);
    await expect(client.fetchQuery(communityQueries.feed())).resolves.toEqual([post]);
    expect(adapter).toHaveBeenCalledOnce();
  });

  it("prepends a published post without losing the existing feed", () => {
    const another = { ...post, id: "post-b", recipe: recipeSummary };
    client.setQueryData(queryKeys.community.feed(), [post]);
    prependCommunityPost(client, another);
    expect(client.getQueryData(queryKeys.community.feed())).toEqual([another, post]);
  });

  it("updates only the toggled post's like state and count", () => {
    const another = { ...post, id: "post-b", likeCount: 8 };
    client.setQueryData(queryKeys.community.feed(), [post, another]);
    updateCommunityLike(client, post.id, { liked: true, likeCount: 3 });
    expect(client.getQueryData<CommunityPost[]>(queryKeys.community.feed())).toEqual([
      { ...post, likedByMe: true, likeCount: 3 }, another,
    ]);
  });

  it("appends a comment and increments only the matching post count", () => {
    const another = { ...post, id: "post-b" };
    client.setQueryData(queryKeys.community.feed(), [post, another]);
    appendCommunityComment(client, post.id, comment);
    expect(client.getQueryData<CommunityPost[]>(queryKeys.community.feed())).toEqual([
      { ...post, comments: [comment], commentCount: 1 }, another,
    ]);
  });
});

describe("Community page business logic", () => {
  it("keeps initials and content normalization behavior", () => {
    expect(communityInitials("  Nguyễn Linh Nhi ")).toBe("LN");
    expect(communityInitials("Nouri")).toBe("N");
    expect(normalizeCommunityContent("  Bữa trưa  ")).toBe("Bữa trưa");
    expect(normalizeCommunityContent("   ")).toBeNull();
  });

  it("keeps Vietnamese relative time formatting", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T10:00:00.000Z"));
    expect(communityRelativeTime("2026-09-15T08:00:00.000Z")).toContain("trước");
  });

  it("keeps save/follow selection local and immutable", () => {
    const selected = new Set(["post-a"]);
    const removed = toggleCommunitySelection(selected, "post-a");
    const added = toggleCommunitySelection(selected, "post-b");
    expect(selected).toEqual(new Set(["post-a"]));
    expect(removed).toEqual(new Set());
    expect(added).toEqual(new Set(["post-a", "post-b"]));
  });

  it("keeps the static topic/member data used by the existing UI", () => {
    expect(suggestedTopics).toHaveLength(4);
    expect(featuredMembers).toEqual([
      { name: "Linh Nhi", role: "Chuyên gia dinh dưỡng" },
      { name: "Minh An", role: "Thành viên tích cực" },
    ]);
  });

  it("uses Web Share when available", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    await shareCommunityPost(post, { share, clipboard: { writeText } });
    expect(share).toHaveBeenCalledWith({ title: "Bài viết của Linh Nhi", text: post.content });
    expect(writeText).not.toHaveBeenCalled();
  });

  it("falls back to clipboard and ignores a cancelled share", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    await shareCommunityPost(post, { clipboard: { writeText } });
    expect(writeText).toHaveBeenCalledWith(post.content);

    const share = vi.fn().mockRejectedValue(new Error("cancelled"));
    await expect(shareCommunityPost(post, { share })).resolves.toBeUndefined();
  });
});

describe("Community element ids and limits", () => {
  it("keeps the post anchor used by notification links (?post=) and the comment input id", () => {
    expect(communityPostElementId("post-a")).toBe("post-post-a");
    expect(communityCommentInputId("post-a")).toBe("comment-post-a");
  });
  it("matches the backend content limits", () => {
    expect(COMMUNITY_POST_MAX_LENGTH).toBe(2000);
    expect(COMMUNITY_COMMENT_MAX_LENGTH).toBe(500);
  });
});

describe("Attaching a recipe to a post", () => {
  it("needs text or a recipe and sends the trimmed text with the recipe id", () => {
    expect(toCommunityPublishInput("  Bữa trưa  ", null)).toEqual({ content: "Bữa trưa" });
    expect(toCommunityPublishInput("   ", recipeSummary)).toEqual({ content: "", recipeId: "recipe-a" });
    expect(toCommunityPublishInput(" Ngon ", recipeSummary)).toEqual({ content: "Ngon", recipeId: "recipe-a" });
    expect(toCommunityPublishInput("   ", null)).toBeNull();
  });

  it("searches recipe names ignoring case and Vietnamese accents", () => {
    expect(normalizeSearchText("  Cá   KHO Tộ ")).toBe("ca kho to");
    expect(normalizeSearchText("Đậu hũ")).toBe("dau hu");
    const recipes = [{ name: "Cá kho tộ (kèm cơm)" }, { name: "Đậu hũ sốt cà chua" }, { name: "Canh chua cá lóc" }];
    expect(filterAttachableRecipes(recipes, "ca kho").map((recipe) => recipe.name)).toEqual(["Cá kho tộ (kèm cơm)"]);
    expect(filterAttachableRecipes(recipes, "dau").map((recipe) => recipe.name)).toEqual(["Đậu hũ sốt cà chua"]);
    expect(filterAttachableRecipes(recipes, "  ")).toEqual(recipes);
    expect(filterAttachableRecipes(recipes, "phở")).toEqual([]);
  });

  it("limits picker results", () => {
    const many = Array.from({ length: 20 }, (_, index) => ({ name: `Món ${index}` }));
    expect(COMMUNITY_RECIPE_PICKER_LIMIT).toBe(8);
    expect(filterAttachableRecipes(many, "")).toHaveLength(8);
    expect(filterAttachableRecipes(many, "món", 3)).toHaveLength(3);
  });

  it("keeps only the summary fields of a full recipe", () => {
    const full = { ...recipeSummary, imageUrl: undefined, description: "x", ingredients: [], instructions: [] };
    expect(toCommunityRecipeSummary(full)).toEqual(recipeSummary);
  });

  it("builds the share-from-recipe link read by the community page", () => {
    expect(SHARE_RECIPE_PARAM).toBe("shareRecipe");
    expect(communityShareRecipePath("recipe a")).toBe("/community?shareRecipe=recipe%20a");
  });

  it("shares the recipe name when a post has no text", async () => {
    const recipeOnly = { ...post, content: "", recipe: recipeSummary };
    expect(communityShareText(recipeOnly)).toBe("Công thức: Cá kho tộ (kèm cơm)");
    expect(communityShareText(post)).toBe(post.content);
    const writeText = vi.fn().mockResolvedValue(undefined);
    await shareCommunityPost(recipeOnly, { clipboard: { writeText } });
    expect(writeText).toHaveBeenCalledWith("Công thức: Cá kho tộ (kèm cơm)");
  });
});

describe("Sharing a discontinued recipe", () => {
  it("refuses to attach a hidden recipe from ?shareRecipe= and explains why", () => {
    expect(shareRecipeError(undefined)).toBe("Không tìm thấy công thức để chia sẻ.");
    expect(shareRecipeError({ hidden: true })).toBe("Món này đã ngừng sử dụng.");
    expect(shareRecipeError({ hidden: false })).toBeNull();
    expect(shareRecipeError({})).toBeNull();
  });
});

describe("Images in a post (checked before sending)", () => {
  const file = (name: string, type = "image/jpeg", size = 1000) => ({ name, type, size });

  it("adds JPG/PNG/WEBP images up to 4 and reports the first problem", () => {
    const four = ["a", "b", "c", "d"].map((name) => file(`${name}.jpg`));
    expect(COMMUNITY_MAX_IMAGES).toBe(4);
    expect(addCommunityImages([], four)).toEqual({ images: four, error: null });
    expect(addCommunityImages(four, [file("e.jpg")])).toEqual({ images: four, error: "Mỗi bài tối đa 4 ảnh." });
  });

  it("skips a wrong type or a file over 5 MB but keeps the valid ones", () => {
    const result = addCommunityImages([], [file("a.gif", "image/gif"), file("b.png", "image/png", 6 * 1024 * 1024), file("c.webp", "image/webp")]);
    expect(result.images.map((image) => image.name)).toEqual(["c.webp"]);
    expect(result.error).toBe("\"a.gif\" không phải ảnh JPG, PNG hoặc WEBP.");
    expect(addCommunityImages([], [file("b.png", "image/png", 6 * 1024 * 1024)]).error).toBe("\"b.png\" vượt quá 5 MB.");
  });

  it("lets a post with only images be published", () => {
    const images = [new File(["x"], "a.jpg", { type: "image/jpeg" })];
    expect(toCommunityPublishInput("  ", null, images)).toEqual({ content: "", images });
    expect(toCommunityPublishInput("  ", null, [])).toBeNull();
  });

  it("sends multipart with the images field when there are images, JSON otherwise", async () => {
    const adapter = vi.fn(async (config) => ({ config, data: post, status: 201, statusText: "Created", headers: {} }));
    api.defaults.adapter = adapter;
    const image = new File(["x"], "a.jpg", { type: "image/jpeg" });
    await publishCommunityPost({ content: "Bữa trưa", recipeId: "recipe-a", images: [image] });
    const body = adapter.mock.calls[0][0].data as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get("content")).toBe("Bữa trưa");
    expect(body.get("recipeId")).toBe("recipe-a");
    expect(body.getAll("images")).toHaveLength(1);
    await publishCommunityPost({ content: "Bữa tối", images: [] });
    expect(JSON.parse(adapter.mock.calls[1][0].data)).toEqual({ content: "Bữa tối" });
  });
});

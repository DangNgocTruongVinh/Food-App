import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import {
  BarChart3,
  Bookmark,
  BookOpen,
  Check,
  Hash,
  Heart,
  ImageIcon,
  Leaf,
  MessageCircle,
  MoreHorizontal,
  Send,
  Share2,
  Sparkles,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { api, getApiError } from "../api/client";
import { LoadingState } from "../components/States";
import { useAuth } from "../contexts/AuthContext";
import type { CommunityComment, CommunityPost } from "../types";

const communityKey = ["community"] as const;

const suggestedTopics = [
  { label: "Bữa ăn hôm nay", count: 128 },
  { label: "Mẹo bảo quản", count: 86 },
  { label: "Công thức lành mạnh", count: 256 },
  { label: "Hành trình của tôi", count: 112 },
];

const featuredMembers = [
  { name: "Linh Nhi", role: "Chuyên gia dinh dưỡng" },
  { name: "Minh An", role: "Thành viên tích cực" },
];

function initials(name: string) {
  return name.trim().split(/\s+/).slice(-2).map((part) => part.charAt(0).toUpperCase()).join("");
}

function relativeTime(value: string) {
  return formatDistanceToNow(new Date(value), { addSuffix: true, locale: vi });
}

export default function CommunityPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [postContent, setPostContent] = useState("");
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [savedPosts, setSavedPosts] = useState<Set<string>>(() => new Set());
  const [followedMembers, setFollowedMembers] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState("");

  const feed = useQuery({
    queryKey: communityKey,
    queryFn: async () => (await api.get<CommunityPost[]>("/community")).data,
  });

  const publish = useMutation({
    mutationFn: async (content: string) => (await api.post<CommunityPost>("/community", { content })).data,
    onSuccess: (post) => {
      queryClient.setQueryData<CommunityPost[]>(communityKey, (posts = []) => [post, ...posts]);
      setPostContent("");
      setError("");
    },
    onError: (publishError) => setError(getApiError(publishError)),
  });

  const toggleLike = useMutation({
    mutationFn: async (postId: string) => (await api.post<{ liked: boolean; likeCount: number }>(`/community/${postId}/like`)).data,
    onSuccess: (result, postId) => queryClient.setQueryData<CommunityPost[]>(communityKey, (posts = []) => posts.map((post) => (
      post.id === postId ? { ...post, likedByMe: result.liked, likeCount: result.likeCount } : post
    ))),
    onError: (likeError) => setError(getApiError(likeError)),
  });

  const addComment = useMutation({
    mutationFn: async ({ postId, content }: { postId: string; content: string }) => (
      await api.post<CommunityComment>(`/community/${postId}/comments`, { content })
    ).data,
    onSuccess: (comment, { postId }) => {
      queryClient.setQueryData<CommunityPost[]>(communityKey, (posts = []) => posts.map((post) => (
        post.id === postId
          ? { ...post, comments: [...post.comments, comment], commentCount: post.commentCount + 1 }
          : post
      )));
      setCommentDrafts((drafts) => ({ ...drafts, [postId]: "" }));
      setError("");
    },
    onError: (commentError) => setError(getApiError(commentError)),
  });

  const submitPost = (event: FormEvent) => {
    event.preventDefault();
    const content = postContent.trim();
    if (content) publish.mutate(content);
  };

  const submitComment = (event: FormEvent, postId: string) => {
    event.preventDefault();
    const content = commentDrafts[postId]?.trim();
    if (content) addComment.mutate({ postId, content });
  };

  const toggleSaved = (postId: string) => {
    setSavedPosts((current) => {
      const next = new Set(current);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  };

  const toggleFollow = (name: string) => {
    setFollowedMembers((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const sharePost = async (post: CommunityPost) => {
    try {
      if (navigator.share) {
        await navigator.share({ title: `Bài viết của ${post.author.name}`, text: post.content });
      } else {
        await navigator.clipboard?.writeText(post.content);
      }
    } catch {
      // Người dùng có thể đóng hộp thoại chia sẻ mà không thực hiện hành động.
    }
  };

  return (
    <div className="page community-page">
      <header className="community-hero">
        <div className="community-hero-copy">
          <span className="community-kicker"><UsersRound /> Cộng đồng NOURI</span>
          <h1><span>Cùng nhau</span> ăn ngon, sống khỏe</h1>
          <p>Chia sẻ bữa ăn, mẹo dinh dưỡng và những thay đổi nhỏ giúp hành trình lành mạnh trở nên vui hơn mỗi ngày.</p>
        </div>
        <div className="community-hero-art" aria-hidden="true">
          <span className="community-hero-glow" />
          <img src="/assets/recipe-vegan-bowl.jpg" alt="" />
          <Leaf className="hero-leaf hero-leaf-one" />
          <Leaf className="hero-leaf hero-leaf-two" />
          <Leaf className="hero-leaf hero-leaf-three" />
        </div>
      </header>

      <div className="community-layout">
        <main className="community-feed">
          <form className="community-composer" onSubmit={submitPost}>
            <span className="community-avatar">{initials(user?.name ?? "N")}</span>
            <div className="community-composer-body">
              <label htmlFor="community-post">Chia sẻ với cộng đồng</label>
              <textarea
                id="community-post"
                rows={3}
                maxLength={2000}
                value={postContent}
                onChange={(event) => setPostContent(event.target.value)}
                placeholder="Hôm nay bạn đã nấu món gì, học được mẹo nào hay?"
              />
              <footer className="community-composer-footer">
                <div className="community-composer-tools" aria-label="Loại nội dung">
                  <button type="button" title="Đính kèm ảnh"><ImageIcon /> <span>Ảnh</span></button>
                  <button type="button" title="Chia sẻ công thức"><BookOpen /> <span>Công thức</span></button>
                  <button type="button" title="Tạo thăm dò"><BarChart3 /> <span>Thăm dò ý kiến</span></button>
                </div>
                <div className="community-publish-row">
                  <small>{postContent.length}/2000</small>
                  <button className="community-publish" disabled={!postContent.trim() || publish.isPending}>
                    <Send /> {publish.isPending ? "Đang đăng..." : "Đăng bài"}
                  </button>
                </div>
              </footer>
            </div>
          </form>

          {error && <div className="form-error community-error">{error}</div>}
          {feed.isLoading && <LoadingState label="Đang tải bài viết..." />}
          {feed.isError && (
            <div className="state">
              <p>{getApiError(feed.error)}</p>
              <button className="button secondary" onClick={() => feed.refetch()}>Thử lại</button>
            </div>
          )}
          {feed.data?.length === 0 && (
            <div className="community-empty">
              <UsersRound />
              <h2>Hãy mở đầu câu chuyện</h2>
              <p>Đăng bài đầu tiên để chào đón mọi người vào cộng đồng NOURI.</p>
            </div>
          )}

          {feed.data?.map((post) => (
            <article className="community-post" key={post.id}>
              <header className="community-post-header">
                <span className="community-avatar">{initials(post.author.name)}</span>
                <div className="community-post-author">
                  <strong>{post.author.name}</strong>
                  <div className="community-post-meta">
                    <time dateTime={post.createdAt}>{relativeTime(post.createdAt)}</time>
                    <span className="community-member-badge"><Sparkles /> Thành viên tích cực</span>
                  </div>
                </div>
                <button className="community-post-menu" type="button" aria-label="Tùy chọn bài viết"><MoreHorizontal /></button>
              </header>

              <p className="community-post-content">{post.content}</p>

              <div className="community-post-stats">
                <span><Heart /> {post.likeCount} lượt thích</span>
                <span>{post.commentCount} bình luận</span>
              </div>
              <div className="community-post-actions">
                <button type="button" className={post.likedByMe ? "liked" : ""} aria-pressed={post.likedByMe} disabled={toggleLike.isPending && toggleLike.variables === post.id} onClick={() => toggleLike.mutate(post.id)}>
                  <Heart /> {post.likedByMe ? "Đã thích" : "Thích"}
                </button>
                <button type="button" onClick={() => document.getElementById(`comment-${post.id}`)?.focus()}><MessageCircle /> Bình luận</button>
                <button type="button" onClick={() => void sharePost(post)}><Share2 /> Chia sẻ</button>
                <button type="button" className={savedPosts.has(post.id) ? "saved" : ""} aria-pressed={savedPosts.has(post.id)} onClick={() => toggleSaved(post.id)}>
                  <Bookmark /> {savedPosts.has(post.id) ? "Đã lưu" : "Lưu"}
                </button>
              </div>

              {post.comments.length > 0 && (
                <div className="community-comments">
                  {post.comments.map((comment) => (
                    <div className="community-comment" key={comment.id}>
                      <span className="community-avatar small">{initials(comment.author.name)}</span>
                      <div>
                        <header><strong>{comment.author.name}</strong><time dateTime={comment.createdAt}>{relativeTime(comment.createdAt)}</time></header>
                        <p>{comment.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <form className="community-comment-form" onSubmit={(event) => submitComment(event, post.id)}>
                <span className="community-avatar small">{initials(user?.name ?? "N")}</span>
                <div>
                  <input
                    id={`comment-${post.id}`}
                    maxLength={500}
                    value={commentDrafts[post.id] ?? ""}
                    onChange={(event) => setCommentDrafts((drafts) => ({ ...drafts, [post.id]: event.target.value }))}
                    placeholder="Viết bình luận..."
                    aria-label={`Bình luận bài viết của ${post.author.name}`}
                  />
                  <button aria-label="Gửi bình luận" disabled={!commentDrafts[post.id]?.trim() || (addComment.isPending && addComment.variables?.postId === post.id)}><Send /></button>
                </div>
              </form>
            </article>
          ))}
        </main>

        <aside className="community-side">
          <section className="community-positive-card">
            <header><span><Sparkles /></span><h2>Không gian tích cực</h2></header>
            <p>Chia sẻ chân thành, tôn trọng trải nghiệm của nhau và cùng lan tỏa những lựa chọn lành mạnh.</p>
            <div className="community-positive-art" aria-hidden="true">
              <span>LN</span><span>MA</span><span>AT</span>
              <MessageCircle /><Heart />
            </div>
          </section>

          <section className="community-topics-card">
            <h2>Gợi ý chủ đề</h2>
            <ul>
              {suggestedTopics.map((topic) => (
                <li key={topic.label}>
                  <span><Hash /> {topic.label}</span>
                  <small>{topic.count} bài viết</small>
                </li>
              ))}
            </ul>
          </section>

          <section className="community-members-card">
            <header><h2>Thành viên nổi bật</h2><button type="button">Xem tất cả</button></header>
            <div className="community-member-list">
              {featuredMembers.map((member) => {
                const followed = followedMembers.has(member.name);
                return (
                  <div className="community-member" key={member.name}>
                    <span className="community-avatar small">{initials(member.name)}</span>
                    <div><strong>{member.name}</strong><small>{member.role}</small></div>
                    <button type="button" className={followed ? "followed" : ""} onClick={() => toggleFollow(member.name)}>
                      {followed ? <Check /> : <UserPlus />} {followed ? "Đã theo dõi" : "Theo dõi"}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

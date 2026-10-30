import { UsersRound } from "lucide-react";

export function CommunityFeedError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="state">
    <p>{message}</p>
    <button className="button secondary" onClick={onRetry}>Thử lại</button>
  </div>;
}

export function CommunityFeedEmpty() {
  return <div className="community-empty">
    <UsersRound />
    <h2>Hãy mở đầu câu chuyện</h2>
    <p>Đăng bài đầu tiên để chào đón mọi người vào cộng đồng NOURI.</p>
  </div>;
}

import { Check, Hash, Heart, MessageCircle, Sparkles, UserPlus } from "lucide-react";
import { communityInitials, featuredMembers, suggestedTopics } from "../../features/community/community.logic";

type CommunitySidebarProps = { followedMembers: Set<string>; onToggleFollow: (name: string) => void };

export default function CommunitySidebar({ followedMembers, onToggleFollow }: CommunitySidebarProps) {
  return <aside className="community-side">
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
              <span className="community-avatar small">{communityInitials(member.name)}</span>
              <div><strong>{member.name}</strong><small>{member.role}</small></div>
              <button type="button" className={followed ? "followed" : ""} onClick={() => onToggleFollow(member.name)}>
                {followed ? <Check /> : <UserPlus />} {followed ? "Đã theo dõi" : "Theo dõi"}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  </aside>;
}

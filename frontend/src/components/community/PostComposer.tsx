import { Send } from "lucide-react";
import type { FormEvent } from "react";
import { COMMUNITY_POST_MAX_LENGTH, communityInitials } from "../../features/community/community.logic";

type PostComposerProps = {
  userName?: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  isPending: boolean;
};

export default function PostComposer({ userName, value, onChange, onSubmit, isPending }: PostComposerProps) {
  return <form className="community-composer" onSubmit={onSubmit}>
    <span className="community-avatar">{communityInitials(userName ?? "N")}</span>
    <div className="community-composer-body">
      <label htmlFor="community-post">Chia sẻ với cộng đồng</label>
      <textarea
        id="community-post"
        rows={3}
        maxLength={COMMUNITY_POST_MAX_LENGTH}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Hôm nay bạn đã nấu món gì, học được mẹo nào hay?"
      />
      <footer className="community-composer-footer">
        <div className="community-publish-row">
          <small>{value.length}/{COMMUNITY_POST_MAX_LENGTH}</small>
          <button className="community-publish" disabled={!value.trim() || isPending}>
            <Send /> {isPending ? "Đang đăng..." : "Đăng bài"}
          </button>
        </div>
      </footer>
    </div>
  </form>;
}

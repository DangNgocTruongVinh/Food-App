import { Link } from "react-router-dom";

/** Trợ lý AI không dùng được (chưa có key hoặc OpenAI lỗi): báo rõ và gợi ý hai tính năng không cần AI. */
export function AssistantUnavailable({ message }: { message: string }) {
  return (
    <p className="ui-notice ui-notice--error as-unavailable" role="status">
      <span>
        {message} Trong lúc chờ, bạn vẫn có thể xem <Link to="/dashboard">Gợi ý cho bạn</Link> ở Tổng quan
        hoặc <Link to="/pantry">Nấu gì từ kho?</Link> ở Kho thực phẩm.
      </span>
    </p>
  );
}

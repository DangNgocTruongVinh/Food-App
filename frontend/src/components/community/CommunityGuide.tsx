import { Link } from "react-router-dom";
import { COMMUNITY_MAX_IMAGES } from "../../features/community/community.logic";
import { Card } from "../ui";

/** Cột phải (≥ 1024px): cách đăng món kèm công thức và ảnh. Không có thành viên/chủ đề nổi bật hay số liệu giả. */
export default function CommunityGuide() {
  return (
    <Card as="aside" variant="quiet" className="cm-guide" aria-labelledby="cm-guide-title">
      <h2 id="cm-guide-title" className="cm-guide__title">Đăng món kèm công thức</h2>
      <ul className="cm-guide__list">
        <li><strong>Viết vài dòng</strong> về món bạn nấu: hôm nào, cho ai, có đổi gì so với công thức.</li>
        <li>
          <strong>Thêm ảnh</strong>: tối đa {COMMUNITY_MAX_IMAGES} ảnh JPG, PNG hoặc WEBP, mỗi ảnh tới 5 MB.
          Vị trí chụp (GPS) trong ảnh được xóa trước khi đăng.
        </li>
        <li><strong>Gắn công thức</strong> bằng nút "Công thức" để người xem mở ngay cách làm, nguyên liệu và calo.</li>
        <li>
          Đang xem một món? Bấm <strong>"Chia sẻ lên cộng đồng"</strong> ở trang chi tiết, món được gắn sẵn vào ô đăng bài.{" "}
          <Link className="ui-link" to="/recipes">Mở danh sách công thức</Link>
        </li>
      </ul>
    </Card>
  );
}

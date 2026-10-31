import { PageHeader } from "../../components/ui";

// Nội dung bám theo dữ liệu Nouri thực sự lưu và gửi đi (backend: prisma/schema.prisma, modules/ai, Cloudinary).
export default function PrivacyPage() {
  return (
    <article className="info-page">
      <PageHeader title="Chính sách bảo mật" description="Nouri lưu những gì, dùng vào việc gì và gửi cho ai. Cập nhật ngày 31/10/2026." />

      <section className="info-page__section">
        <h2 className="ui-section-title">Dữ liệu Nouri lưu</h2>
        <ul className="info-page__list">
          <li>Tài khoản: họ tên, email và mật khẩu đã băm (bcrypt). Nouri không lưu mật khẩu gốc.</li>
          <li>Hồ sơ dinh dưỡng: giới tính, tuổi, chiều cao, cân nặng, mức vận động, mục tiêu, chế độ ăn, dị ứng và món không thích.</li>
          <li>Kho thực phẩm, thực đơn, danh sách đi chợ và lịch sử trò chuyện với Trợ lý AI.</li>
          <li>Bài viết, bình luận, lượt thích ở Cộng đồng và thông báo gửi cho bạn.</li>
        </ul>
      </section>

      <section className="info-page__section">
        <h2 className="ui-section-title">Ảnh bạn đăng</h2>
        <p className="ui-text">
          Ảnh trong bài viết được lưu trên Cloudinary. Trước khi tải lên, Nouri xóa thông tin EXIF của ảnh (vị trí GPS, thiết bị,
          thời gian chụp). Khi bạn xóa bài, ảnh cũng bị xóa; đường dẫn ảnh cũ có thể còn mở được khoảng một phút do bộ nhớ đệm.
        </p>
      </section>

      <section className="info-page__section">
        <h2 className="ui-section-title">Dữ liệu gửi cho OpenAI</h2>
        <p className="ui-text">
          Khi hệ thống bật OpenAI, câu hỏi bạn gửi Trợ lý AI được gửi kèm hồ sơ dinh dưỡng và danh sách kho để câu trả lời sát với
          bạn; khi tạo thực đơn, chỉ tiêu dinh dưỡng, chế độ ăn, dị ứng, món không thích, kho và danh sách món được gửi để xếp bữa.
          Họ tên, email và mật khẩu không được gửi đi. Khi OpenAI
          không bật, Nouri dùng câu trả lời mẫu và thuật toán gợi ý, không gửi dữ liệu ra ngoài.
        </p>
      </section>

      <section className="info-page__section">
        <h2 className="ui-section-title">Trong trình duyệt của bạn</h2>
        <p className="ui-text">
          Nouri lưu phiên đăng nhập (localStorage nếu chọn "Nhớ đăng nhập", sessionStorage nếu không), tên và email hiển thị, lựa
          chọn "Nhớ đăng nhập" và chế độ sáng/tối. Đăng xuất sẽ xóa phiên đăng nhập.
        </p>
      </section>

      <section className="info-page__section">
        <h2 className="ui-section-title">Quản trị viên</h2>
        <p className="ui-text">
          Quản trị viên xem được danh sách tài khoản (tên, email), có thể khóa tài khoản và xóa bài viết, bình luận vi phạm. Mỗi thao
          tác quản trị được ghi nhật ký (người thực hiện, hành động, đối tượng), không ghi nội dung bài viết hay mật khẩu.
        </p>
      </section>
    </article>
  );
}

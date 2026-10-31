import { PageHeader } from "../../components/ui";

export default function TermsPage() {
  return (
    <article className="info-page">
      <PageHeader title="Điều khoản sử dụng" description="Điều bạn cần biết khi dùng Nouri. Cập nhật ngày 31/10/2026." />

      <section className="info-page__section">
        <h2 className="ui-section-title">Nouri là gì</h2>
        <p className="ui-text">
          Nouri là sản phẩm của một đồ án tốt nghiệp: quản lý kho thực phẩm trong gia đình, gợi ý công thức và lập thực đơn theo hồ
          sơ dinh dưỡng. Dịch vụ có thể thay đổi hoặc tạm dừng mà không báo trước.
        </p>
      </section>

      <section className="info-page__section">
        <h2 className="ui-section-title">Không thay lời khuyên y tế</h2>
        <p className="ui-text">
          Calo và chất dinh dưỡng của món ăn là số ước tính. Chỉ tiêu dinh dưỡng tính theo công thức chung từ hồ sơ của bạn. Cảnh báo
          dị ứng dựa trên tên nguyên liệu nên có thể bỏ sót thành phần ẩn. Nếu bạn có bệnh lý hoặc dị ứng nặng, hãy hỏi ý kiến bác sĩ
          hoặc chuyên gia dinh dưỡng.
        </p>
      </section>

      <section className="info-page__section">
        <h2 className="ui-section-title">Nội dung bạn đăng</h2>
        <ul className="info-page__list">
          <li>Bạn chịu trách nhiệm về bài viết, bình luận và ảnh mình đăng; chỉ đăng ảnh bạn có quyền sử dụng.</li>
          <li>Không đăng nội dung xúc phạm, quảng cáo, lừa đảo hoặc thông tin sai về sức khỏe.</li>
          <li>Quản trị viên có thể xóa nội dung vi phạm và khóa tài khoản vi phạm.</li>
        </ul>
      </section>

      <section className="info-page__section">
        <h2 className="ui-section-title">Tài khoản</h2>
        <p className="ui-text">
          Giữ mật khẩu của bạn an toàn và đăng xuất khi dùng máy chung. Tài khoản bị khóa không đăng nhập và không dùng được các chức
          năng của Nouri.
        </p>
      </section>
    </article>
  );
}

import { Card, EmptyState, PageHeader } from "../../components/ui";

/** Trang Quản trị tạm thời: giao diện Admin làm ở lượt UI-9, UI-10 (API backend đã có). */
export default function AdminHomePage() {
  return (
    <div className="admin-placeholder">
      <PageHeader title="Quản trị" description="Thống kê, công thức, người dùng, kiểm duyệt và nhật ký thao tác." />
      <Card>
        <EmptyState message="Trang quản trị đang xây dựng. Các chức năng sẽ có ở bản cập nhật tới." />
      </Card>
    </div>
  );
}

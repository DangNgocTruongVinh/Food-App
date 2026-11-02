import { Card, EmptyState } from "../../components/ui";

/** Tab Người dùng, Kiểm duyệt, Nhật ký: giao diện làm ở lượt UI-10 (API backend đã có). */
export default function AdminPlaceholderPage({ title }: { title: string }) {
  return (
    <section className="ad-section" aria-labelledby="ad-placeholder-title">
      <h2 id="ad-placeholder-title" className="ad-section__title">{title}</h2>
      <Card>
        <EmptyState message={`Mục ${title.toLocaleLowerCase("vi")} đang xây dựng. API đã sẵn sàng; giao diện có ở bản cập nhật tới.`} />
      </Card>
    </section>
  );
}

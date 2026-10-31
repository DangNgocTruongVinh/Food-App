import { Bell, CalendarPlus, Heart, Search, Trash2, UtensilsCrossed } from "lucide-react";
import { type ReactNode, useState } from "react";
import { type ConfirmRequest, createConfirmController } from "../../features/ui/ui.logic";
import type { Theme } from "../../features/theme/theme.logic";
import { Button, Card, Chip, ConfirmDialog, EmptyState, ErrorState, Field, IconButton, LoadingState, Logo, PageHeader, Tag } from "../ui";

// Bảng mẫu thành phần cho trang /dev/ui (chỉ môi trường dev). Mỗi cột cố định một chế độ bằng data-theme.

const SAMPLE = "Sống uống ặc ữ ỗ ẫ ợ Đậu hũ";
const SANS_WEIGHTS = [400, 500, 600, 700];
const SERIF_WEIGHTS = [400, 500, 600];
const CATEGORIES = [["Tất cả", 33], ["Bữa sáng", 8], ["Món chay", 9]] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="dev-ui-section">
      <h2 className="dev-ui-section__title">{title}</h2>
      {children}
    </section>
  );
}

export function DevUiShowcase({ theme }: { theme: Theme }) {
  const [chip, setChip] = useState<string>("Tất cả");
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const [controller] = useState(() => createConfirmController(setRequest));
  const [answer, setAnswer] = useState<string>("Chưa mở hộp xác nhận.");

  const askDelete = async () => {
    const confirmed = await controller.request({
      title: "Xóa thực đơn Tuần 44?",
      description: "Các bữa và danh sách đi chợ của thực đơn này sẽ bị xóa, không khôi phục được.",
      confirmLabel: "Xóa thực đơn",
    });
    setAnswer(confirmed ? "Đã xóa thực đơn (mẫu)." : "Đã hủy, thực đơn vẫn còn.");
  };

  return (
    <div data-theme={theme} className="ui-root dev-ui-panel">
      <p className="ui-small">Chế độ {theme === "dark" ? "tối" : "sáng"}</p>

      <Section title="Logo và đầu trang">
        <Logo />
        <PageHeader
          size="hero"
          title={<>Hôm nay <em>nấu gì?</em></>}
          description="Ức gà còn 2 ngày trong kho. Món gợi ý dùng hết phần còn lại."
          actions={<><Button variant="primary" icon={<UtensilsCrossed />}>Xem công thức</Button><Button icon={<CalendarPlus />}>Thêm vào thực đơn</Button></>}
        />
        <PageHeader title={<>Tủ bếp <em>của bạn</em></>} actions={<Button variant="primary">Thêm thực phẩm</Button>} />
      </Section>

      <Section title="Chữ">
        <h2 className="ui-section-title">Thực đơn hôm nay</h2>
        <h3 className="ui-card-title">Canh chua cá lóc</h3>
        <p className="ui-stat">1.986 <span className="ui-small">kcal</span></p>
        <p className="ui-text">Bạn đã có 5/7 nguyên liệu. Còn thiếu me chua và bạc hà, mua thêm trước bữa tối.</p>
        <p className="ui-small">Cập nhật lúc 07:30</p>
        <span className="ui-label">Hạn sử dụng</span>
        <div className="dev-ui-fonts">
          {SANS_WEIGHTS.map((weight) => <p key={`sans-${weight}`} className="dev-ui-font dev-ui-font--sans" style={{ fontWeight: weight }}>{weight} {SAMPLE}</p>)}
          {[400, 500, 600].map((weight) => <p key={`sans-i-${weight}`} className="dev-ui-font dev-ui-font--sans" style={{ fontWeight: weight, fontStyle: "italic" }}>{weight} nghiêng {SAMPLE}</p>)}
          {SERIF_WEIGHTS.map((weight) => <p key={`serif-${weight}`} className="dev-ui-font dev-ui-font--serif" style={{ fontWeight: weight }}>{weight} {SAMPLE}</p>)}
          {SERIF_WEIGHTS.map((weight) => <p key={`serif-i-${weight}`} className="dev-ui-font dev-ui-font--serif" style={{ fontWeight: weight, fontStyle: "italic" }}>{weight} nghiêng {SAMPLE}</p>)}
        </div>
      </Section>

      <Section title="Nút">
        <div className="dev-ui-row">
          <Button variant="primary">Lưu vào kho</Button>
          <Button>Quét hóa đơn</Button>
          <Button variant="danger" icon={<Trash2 />}>Xóa thực phẩm</Button>
        </div>
        <div className="dev-ui-row">
          <Button variant="primary" busy>Đang lưu</Button>
          <Button disabled>Tạo thực đơn</Button>
          <IconButton label="Tìm kiếm" icon={<Search />} />
          <IconButton label="Thông báo" icon={<Bell />} quiet />
          <IconButton label="Chỉ hiện món yêu thích" icon={<Heart />} pressed />
        </div>
      </Section>

      <Section title="Ô nhập">
        <div className="dev-ui-fields">
          <Field label="Tên thực phẩm" placeholder="Ví dụ: Ức gà" hint="Tên hiển thị trong kho và danh sách đi chợ." />
          <Field label="Số lượng" inputMode="decimal" defaultValue="0" error="Nhập số lớn hơn 0." />
          <Field label="Nơi bảo quản">
            {(control) => <select {...control} defaultValue="FRIDGE"><option value="FRIDGE">Ngăn mát</option><option value="FREEZER">Ngăn đá</option></select>}
          </Field>
          <Field label="Ghi chú">{(control) => <textarea {...control} placeholder="Mua ở chợ Bến Thành" />}</Field>
        </div>
      </Section>

      <Section title="Chip và nhãn">
        <div className="dev-ui-row" role="group" aria-label="Danh mục mẫu">
          {CATEGORIES.map(([name, count]) => <Chip key={name} selected={chip === name} count={count} onClick={() => setChip(name)}>{name}</Chip>)}
        </div>
        <div className="dev-ui-row"><Tag>Ăn chay</Tag><Tag>Giàu đạm</Tag><Tag>Ít tinh bột</Tag></div>
      </Section>

      <Section title="Card">
        <Card as="article">
          <h3 className="ui-card-title">Cần dùng sớm</h3>
          <p className="ui-text">Ức gà còn 2 ngày, sữa chua còn 1 ngày.</p>
        </Card>
        <Card variant="quiet"><p className="ui-small">Khối phụ (nền surface-2, không viền) cho thông tin ít quan trọng.</p></Card>
      </Section>

      <Section title="Trạng thái">
        <LoadingState label="Đang tải danh sách mẫu" />
        <LoadingState label="Đang tải công thức mẫu" shape="cards" count={2} />
        <Card><EmptyState message="Kho chưa có thực phẩm nào." action={<Button variant="primary">Thêm thực phẩm</Button>} /></Card>
        <ErrorState message="Chưa tải được kho thực phẩm. Kiểm tra kết nối rồi thử lại." onRetry={() => undefined} />
      </Section>

      <Section title="Hộp xác nhận">
        <div className="dev-ui-row">
          <Button variant="danger" icon={<Trash2 />} onClick={askDelete}>Xóa thực đơn</Button>
          <p className="ui-small" aria-live="polite">{answer}</p>
        </div>
        <ConfirmDialog request={request} onAnswer={controller.answer} />
      </Section>
    </div>
  );
}

import { DevUiShowcase } from "../../components/dev-ui/DevUiShowcase";
import { Logo, ThemeToggle } from "../../components/ui";
import "../../styles/ui/dev-ui.css";

/**
 * Trang nội bộ /dev/ui (chỉ khai báo khi import.meta.env.DEV): mọi thành phần components/ui ở cả hai chế độ.
 * Nút chế độ tối ở đầu trang đổi chế độ chung (nhớ trong localStorage); hai cột bên dưới luôn cố định sáng / tối.
 */
export default function DevUiPage() {
  return (
    <div className="ui-root dev-ui">
      <header className="dev-ui-header">
        <Logo />
        <p className="ui-small">Trang mẫu thành phần (chỉ ở môi trường dev)</p>
        <ThemeToggle />
      </header>
      <main className="dev-ui-grid">
        <DevUiShowcase theme="light" />
        <DevUiShowcase theme="dark" />
      </main>
    </div>
  );
}

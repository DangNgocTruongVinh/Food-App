import { DevUiShowcase } from "../../components/dev-ui/DevUiShowcase";
import { Logo } from "../../components/ui";
import "../../styles/ui/dev-ui.css";

/**
 * Trang nội bộ /dev/ui (chỉ khai báo khi import.meta.env.DEV): mọi thành phần components/ui (chỉ giao diện sáng).
 */
export default function DevUiPage() {
  return (
    <div className="ui-root dev-ui">
      <header className="dev-ui-header">
        <Logo />
        <p className="ui-small">Trang mẫu thành phần (chỉ ở môi trường dev)</p>
      </header>
      <main className="dev-ui-grid">
        <DevUiShowcase />
      </main>
    </div>
  );
}

import { Component, type ErrorInfo, type ReactNode } from "react";
import { claimChunkReload, sessionStore } from "../features/ui/error-recovery.logic";
import { Button } from "./ui";

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Bao quanh trang: một phần lỗi thì hiện "Đã có lỗi, tải lại trang" thay vì trang trắng. Lỗi tải file JS sau khi build lại thì
 * tự tải lại trang một lần. Nơi dùng đặt key theo đường dẫn để chuyển trang là thử lại.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (claimChunkReload(error, sessionStore())) {
      window.location.reload();
      return;
    }
    console.error("Lỗi giao diện:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="ui-error-page" role="alert">
        <p className="ui-error-page__title">Đã có lỗi, tải lại trang</p>
        <p className="ui-small">Một phần của trang không hiển thị được. Dữ liệu của bạn không bị ảnh hưởng.</p>
        <Button variant="primary" onClick={() => window.location.reload()}>Tải lại trang</Button>
      </div>
    );
  }
}

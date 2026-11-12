import { useMutation } from "@tanstack/react-query";
import { Check, CircleAlert, LoaderCircle } from "lucide-react";
import { useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AuthShell } from "../components/auth/AuthShell";
import { recoveryErrorMessage } from "../features/auth/auth.logic";
import { unsubscribeExpiryEmail } from "../features/profile/expiry-email.api";

/**
 * /tat-nhac-han?u=…&t=…: "Tắt nhắc" một chạm từ email nhắc hạn, không cần đăng nhập. Tắt bằng JavaScript khi trang mở (không phải
 * GET của máy chủ) để trình quét liên kết trong hộp thư không tự tắt nhắc thay người dùng.
 */
export default function UnsubscribeExpiryPage() {
  const [params] = useSearchParams();
  const userId = params.get("u") ?? "";
  const token = params.get("t") ?? "";
  const unsubscribe = useMutation({ mutationFn: () => unsubscribeExpiryEmail(userId, token) });
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !userId || !token) return;
    started.current = true;
    unsubscribe.mutate();
  }, [userId, token, unsubscribe]);

  const invalid = !userId || !token;
  return (
    <AuthShell label="Tắt nhắc đồ sắp hết hạn">
      <div className="dn-stack">
        <h1 className="dn-title">Tắt nhắc qua email</h1>
        {invalid ? (
          <p className="dn-alert" role="alert"><CircleAlert aria-hidden="true" />Liên kết tắt nhắc thiếu thông tin. Hãy mở lại liên kết trong email.</p>
        ) : unsubscribe.isError ? (
          <p className="dn-alert" role="alert"><CircleAlert aria-hidden="true" />{recoveryErrorMessage(unsubscribe.error)}</p>
        ) : unsubscribe.isSuccess ? (
          <p className="dn-alert dn-alert--ok" role="status"><Check aria-hidden="true" />{unsubscribe.data.message}</p>
        ) : (
          <p className="dn-lede" role="status"><LoaderCircle className="dn-spin" aria-hidden="true" /> Đang tắt nhắc…</p>
        )}
        <p className="dn-foot"><Link className="dn-link dn-link--gold" to="/profile">Mở Hồ sơ</Link></p>
      </div>
    </AuthShell>
  );
}

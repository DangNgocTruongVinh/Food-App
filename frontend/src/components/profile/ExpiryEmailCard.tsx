import { MailCheck } from "lucide-react";
import { EXPIRY_DAY_OPTIONS } from "../../features/profile/profile.logic";
import { Button, ChoiceGroup, ErrorState } from "../ui";

type ExpiryEmailCardProps = {
  enabled: boolean;
  days: number;
  saving: boolean;
  testing: boolean;
  error: string;
  onChange: (settings: { expiryEmailEnabled: boolean; expiryEmailDays: number }) => void;
  onTest: () => void;
};

/** Hồ sơ: bật/tắt email nhắc đồ sắp hết hạn (mặc định tắt), số ngày báo trước, "Gửi thử ngay" (tối đa 3 lần/ngày). Đổi là lưu ngay. */
export function ExpiryEmailCard({ enabled, days, saving, testing, error, onChange, onTest }: ExpiryEmailCardProps) {
  return (
    <section className="hs-form hs-expiry" aria-labelledby="hs-expiry-title" aria-busy={saving}>
      <div className="hs-section">
        <header className="hs-section__head">
          <h2 id="hs-expiry-title" className="hs-section__title">Nhắc đồ sắp hết hạn qua email</h2>
          <p className="ui-small">
            Mỗi sáng Nouri gửi một email liệt kê thực phẩm sắp hết hạn và gợi ý món nên nấu. Không có gì sắp hết hạn thì không gửi.
          </p>
        </header>
        <label className="hs-switch">
          <input
            type="checkbox" role="switch" checked={enabled} disabled={saving}
            onChange={(event) => onChange({ expiryEmailEnabled: event.target.checked, expiryEmailDays: days })}
          />
          <span>Nhắc đồ sắp hết hạn qua email</span>
        </label>
        <ChoiceGroup
          legend="Báo trước" name="expiry-email-days" options={EXPIRY_DAY_OPTIONS} value={String(days)}
          onChange={(value) => onChange({ expiryEmailEnabled: enabled, expiryEmailDays: Number(value) })}
        />
      </div>
      <div className="hs-actions">
        {error && <ErrorState message={error} />}
        <div className="hs-actions__bar">
          <Button icon={<MailCheck />} busy={testing} onClick={onTest}>Gửi thử ngay</Button>
        </div>
      </div>
    </section>
  );
}

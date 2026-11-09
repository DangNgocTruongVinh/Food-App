import { CircleAlert, Package, Plus, ReceiptText } from "lucide-react";
import { Link } from "react-router-dom";
import { daysLeft, daysLeftLabel, expiringCountLabel, formatNumber } from "../../features/dashboard/dashboard.logic";
import type { PantryItem } from "../../types";
import { ButtonLink, Card, EmptyState } from "../ui";

type PantrySnapshotProps = { pantryCount: number; expiringItems: PantryItem[]; expiredCount: number };

/** Tủ bếp: số liệu thật từ dashboard API; món cần dùng sớm mở thẳng dòng đó trong Kho (?item=). */
export function PantrySnapshot({ pantryCount, expiringItems, expiredCount }: PantrySnapshotProps) {
  return (
    <Card as="section" className="dash-card" aria-labelledby="dash-pantry-title">
      <header className="dash-card__header">
        <h2 id="dash-pantry-title" className="ui-section-title">Tủ bếp của bạn</h2>
        {pantryCount > 0 && <Link className="ui-link" to="/pantry">Mở kho thực phẩm</Link>}
      </header>
      {!pantryCount ? (
        <EmptyState
          icon={<Package />}
          message="Kho chưa có thực phẩm nào. Thêm thực phẩm để Nouri gợi ý món và nhắc hạn sử dụng."
          action={(
            <div className="dash-pantry__actions">
              <ButtonLink variant="primary" to="/pantry" icon={<Plus />}>Thêm thực phẩm</ButtonLink>
              <ButtonLink to="/pantry?scan=1" icon={<ReceiptText />}>Quét hóa đơn</ButtonLink>
            </div>
          )}
        />
      ) : (
        <div className="dash-pantry">
          <div className="dash-pantry__summary">
            <dl className="dash-stats">
              <div className="dash-stat"><dt>Thực phẩm trong kho</dt><dd className="ui-stat">{formatNumber(pantryCount)}</dd></div>
              <div className={expiringItems.length ? "dash-stat dash-stat--warn" : "dash-stat"}>
                <dt>Sắp hết hạn trong 7 ngày</dt><dd className="ui-stat">{expiringCountLabel(expiringItems.length)}</dd>
              </div>
            </dl>
            {expiredCount > 0 && (
              <p className="dash-warning"><CircleAlert aria-hidden="true" />{expiredCount} thực phẩm đã hết hạn. Kiểm tra và bỏ khỏi kho.</p>
            )}
            <div className="dash-pantry__actions">
              <ButtonLink to="/pantry" icon={<Plus />}>Thêm thực phẩm</ButtonLink>
              <ButtonLink to="/pantry?scan=1" icon={<ReceiptText />}>Quét hóa đơn</ButtonLink>
            </div>
          </div>
          <div className="dash-pantry__soon">
            <h3 className="ui-card-title">Cần dùng sớm</h3>
            {expiringItems.length ? (
              <ul className="dash-soon">
                {expiringItems.map((item) => {
                  const days = daysLeft(item.expiryDate);
                  return (
                    <li key={item.id}>
                      <Link className="dash-soon__item" to={`/pantry?item=${encodeURIComponent(item.id)}`}>
                        <span className="dash-soon__name">{item.name}</span>
                        <span className="dash-soon__category">{item.category}</span>
                        <span className={days !== null && days <= 2 ? "dash-soon__days is-urgent" : "dash-soon__days"}>{daysLeftLabel(days)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="ui-text">Không có thực phẩm nào hết hạn trong 7 ngày tới.</p>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

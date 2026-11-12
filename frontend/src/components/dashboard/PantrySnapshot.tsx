import { CircleAlert, Package, Plus, ReceiptText } from "lucide-react";
import { Link } from "react-router-dom";
import { daysLeft, daysLeftLabel } from "../../features/dashboard/dashboard.logic";
import type { PantryItem } from "../../types";
import { ButtonLink, EmptyState } from "../ui";

type PantrySnapshotProps = { pantryCount: number; expiringItems: PantryItem[]; expiredCount: number };

/**
 * Tủ bếp: dải xanh rừng thương hiệu. Số đếm của kho nằm ở dải số liệu đầu trang; ở đây là
 * "Cần dùng sớm" (mỗi món mở thẳng dòng đó trong Kho, ?item=), cảnh báo đồ đã hết hạn và hai nút Thêm thực phẩm / Quét hóa đơn.
 */
export function PantrySnapshot({ pantryCount, expiringItems, expiredCount }: PantrySnapshotProps) {
  return (
    <section className="dash-pantry" aria-labelledby="dash-pantry-title">
      <header className="dash-pantry__head">
        <div className="dash-pantry__intro">
          <h2 id="dash-pantry-title" className="dash-pantry__title">Tủ bếp của bạn</h2>
          {pantryCount > 0 && <p className="dash-pantry__subtitle">Cần dùng sớm, trong 7 ngày tới</p>}
        </div>
        {pantryCount > 0 && <Link className="dash-pantry__link" to="/pantry">Mở kho thực phẩm</Link>}
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
        <>
          {expiringItems.length ? (
            <ul className="dash-soon">
              {expiringItems.map((item) => {
                const days = daysLeft(item.expiryDate);
                return (
                  <li key={item.id}>
                    <Link className="dash-soon__item" to={`/pantry?item=${encodeURIComponent(item.id)}`}>
                      <span className={days !== null && days <= 2 ? "dash-soon__days is-urgent" : "dash-soon__days"}>{daysLeftLabel(days)}</span>
                      <span className="dash-soon__name">{item.name}</span>
                      <span className="dash-soon__category">{item.category}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="dash-pantry__empty">Không có thực phẩm nào hết hạn trong 7 ngày tới.</p>
          )}
          <div className="dash-pantry__foot">
            {expiredCount > 0 ? (
              <p className="dash-warning"><CircleAlert aria-hidden="true" />{expiredCount} thực phẩm đã hết hạn. Kiểm tra và bỏ khỏi kho.</p>
            ) : <span />}
            <div className="dash-pantry__actions">
              <ButtonLink to="/pantry" icon={<Plus />}>Thêm thực phẩm</ButtonLink>
              <ButtonLink to="/pantry?scan=1" icon={<ReceiptText />}>Quét hóa đơn</ButtonLink>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

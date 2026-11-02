import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { AdminPager } from "../../components/admin/AdminListParts";
import { Card, EmptyState, ErrorState, LoadingState, Skeleton } from "../../components/ui";
import { AUDIT_ACTIONS, type AuditAction } from "../../features/admin/admin.api";
import { AUDIT_ACTION_LABELS, auditDetails, auditTarget, auditTargetLink, vietnamTime } from "../../features/admin/admin-people.logic";
import { adminQueries } from "../../features/admin/admin.queries";

const PAGE_SIZE = 20;

/** /admin/audit-logs: chỉ xem. Lọc theo hành động và người thực hiện; đối tượng còn tồn tại có link mở nhanh. */
export default function AdminAuditLogsPage() {
  const [action, setAction] = useState<AuditAction | "">("");
  const [actorId, setActorId] = useState("");
  const [page, setPage] = useState(1);
  const logs = useQuery(adminQueries.auditLogs({ action: action || undefined, actorId: actorId || undefined, page, pageSize: PAGE_SIZE }));
  const existing = useQuery(adminQueries.existing());
  const data = logs.data;
  const filtered = Boolean(action || actorId);

  return (
    <section className="ad-section" aria-labelledby="ad-audit-title">
      <h2 id="ad-audit-title" className="ad-section__title">Nhật ký thao tác</h2>
      <div className="ad-toolbar ad-toolbar--filters">
        <div className="ad-filter-field">
          <label className="ad-filter-field__label" htmlFor="ad-audit-action">Hành động</label>
          <select
            id="ad-audit-action"
            className="ui-input"
            value={action}
            onChange={(event) => { setAction(event.target.value as AuditAction | ""); setPage(1); }}
          >
            <option value="">Tất cả hành động</option>
            {AUDIT_ACTIONS.map((value) => <option key={value} value={value}>{AUDIT_ACTION_LABELS[value]}</option>)}
          </select>
        </div>
        <div className="ad-filter-field">
          <label className="ad-filter-field__label" htmlFor="ad-audit-actor">Người thực hiện</label>
          <select id="ad-audit-actor" className="ui-input" value={actorId} onChange={(event) => { setActorId(event.target.value); setPage(1); }}>
            <option value="">Tất cả quản trị viên</option>
            {existing.data?.admins.map((admin) => <option key={admin.id} value={admin.id}>{admin.name} ({admin.email})</option>)}
          </select>
        </div>
      </div>
      <Card variant="flush" className="ad-panel">
        {logs.isLoading ? (
          <LoadingState label="Đang tải nhật ký">{[0, 1, 2].map((index) => <Skeleton key={index} kind="block" height={56} />)}</LoadingState>
        ) : logs.isError || !data ? (
          <ErrorState message="Chưa tải được nhật ký." onRetry={() => void logs.refetch()} retrying={logs.isFetching} />
        ) : !data.items.length ? (
          <EmptyState message={filtered ? "Không có thao tác nào khớp bộ lọc." : "Chưa có thao tác quản trị nào."} />
        ) : (
          <>
            <table className="ad-table ad-table--audit">
              <thead>
                <tr>
                  <th scope="col">Thời gian (giờ Việt Nam)</th><th scope="col">Người thực hiện</th><th scope="col">Hành động</th>
                  <th scope="col">Đối tượng</th><th scope="col">Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((log) => {
                  const link = existing.data ? auditTargetLink(log, existing.data) : null;
                  const target = auditTarget(log);
                  return (
                    <tr key={log.id} className="ad-row">
                      <td className="ad-num ad-row__time"><time dateTime={log.createdAt}>{vietnamTime(log.createdAt)}</time></td>
                      <td data-label="Người thực hiện">
                        <span className="ad-row__strong ad-block">{log.actor.name}</span>
                        <span className="ad-sub">{log.actor.email}</span>
                      </td>
                      <td data-label="Hành động"><span className="ad-action">{AUDIT_ACTION_LABELS[log.action]}</span></td>
                      <td data-label="Đối tượng">{link ? <Link className="ui-link" to={link}>{target}</Link> : target}</td>
                      <td data-label="Chi tiết" className="ad-row__details">{auditDetails(log) || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <AdminPager
              label="Phân trang nhật ký" summary={`${data.total} thao tác`}
              page={page} total={data.total} pageSize={PAGE_SIZE} onPageChange={setPage}
            />
          </>
        )}
      </Card>
    </section>
  );
}

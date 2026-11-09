import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getApiError } from "../../api/client";
import { AdminPager, AdminSearch } from "../../components/admin/AdminListParts";
import { Button, Card, EmptyState, ErrorState, LoadingState, Skeleton, Tag, Toast, useConfirm } from "../../components/ui";
import { useAuth } from "../../contexts/AuthContext";
import type { AdminUser } from "../../features/admin/admin.api";
import { lockBlockedReason, lockConfirm, vietnamDate, vietnamTime } from "../../features/admin/admin-people.logic";
import { adminMutations, adminQueries, invalidateAdminQueries } from "../../features/admin/admin.queries";

const PAGE_SIZE = 20;

/** /admin/users: tìm theo tên/email (?search= điền sẵn từ link nhật ký), phân trang, Khóa / Mở khóa qua ConfirmDialog. */
export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { user: me } = useAuth();
  const [params] = useSearchParams();
  const [search, setSearch] = useState(params.get("search") ?? "");
  const [query, setQuery] = useState(search);
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState("");
  const [actionError, setActionError] = useState("");
  const clearToast = useCallback(() => setToast(""), []);

  useEffect(() => {
    const timer = window.setTimeout(() => { setQuery(search); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const list = useQuery(adminQueries.users({ search: query, page, pageSize: PAGE_SIZE }));
  const lock = useMutation({ ...adminMutations.setUserLock(), onSuccess: () => invalidateAdminQueries(queryClient) });

  const toggleLock = async (user: AdminUser) => {
    setActionError("");
    if (!(await confirm({ ...lockConfirm(user), tone: user.locked ? undefined : "danger" }))) return;
    lock.mutate({ id: user.id, locked: !user.locked }, {
      onSuccess: () => setToast(user.locked ? `Đã mở khóa ${user.email}.` : `Đã khóa ${user.email}.`),
      // Backend vẫn chặn tự khóa (400) và khóa Admin khác (403); báo đúng lời của máy chủ.
      onError: (error) => setActionError(`Chưa ${user.locked ? "mở khóa" : "khóa"} được ${user.email}: ${getApiError(error)}`),
    });
  };

  const data = list.data;
  return (
    <section className="ad-section" aria-labelledby="ad-users-title">
      <h2 id="ad-users-title" className="ad-section__title">Người dùng</h2>
      <div className="ad-toolbar">
        <AdminSearch id="ad-user-search" label="Tìm theo tên hoặc email" value={search} onChange={setSearch} />
      </div>
      {actionError && <ErrorState message={actionError} />}
      <Card variant="flush" className="ad-panel">
        {list.isLoading ? (
          <LoadingState label="Đang tải người dùng">{[0, 1, 2].map((index) => <Skeleton key={index} kind="block" height={64} />)}</LoadingState>
        ) : list.isError || !data ? (
          <ErrorState message="Chưa tải được danh sách người dùng." onRetry={() => void list.refetch()} retrying={list.isFetching} />
        ) : !data.items.length ? (
          <EmptyState message={query ? "Không có tài khoản nào có tên hoặc email như vậy." : "Chưa có tài khoản nào."} />
        ) : (
          <>
            <table className="ad-table">
              <thead>
                <tr>
                  <th scope="col">Người dùng</th><th scope="col">Vai trò</th><th scope="col">Ngày tạo</th><th scope="col">Bài viết</th>
                  <th scope="col">Thực đơn</th><th scope="col">Trạng thái</th><th scope="col"><span className="ui-visually-hidden">Thao tác</span></th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((user) => {
                  const reason = lockBlockedReason(user, me?.id);
                  return (
                    <tr key={user.id} className="ad-row">
                      <td className="ad-row__person">
                        <span className="ad-row__strong ad-block">{user.name}</span>
                        <span className="ad-sub ad-block">{user.email}</span>
                      </td>
                      <td data-label="Vai trò">
                        {user.role === "ADMIN" ? "Quản trị viên" : "Người dùng"}
                        {user.isSample && <span className="ad-sub ad-block"><Tag>Tài khoản mẫu</Tag></span>}
                      </td>
                      <td data-label="Ngày tạo" className="ad-num">{vietnamDate(user.createdAt)}</td>
                      <td data-label="Bài viết" className="ad-num">{user.postCount}</td>
                      <td data-label="Thực đơn" className="ad-num">{user.mealPlanCount}</td>
                      <td data-label="Trạng thái">
                        {user.locked
                          ? (
                            <>
                              <span className="ad-status ad-status--hidden">Đã khóa</span>
                              <span className="ad-sub ad-block">từ {vietnamTime(user.lockedAt!)}</span>
                            </>
                          )
                          : <span className="ad-status">Đang hoạt động</span>}
                      </td>
                      <td className="ad-row__actions">
                        {reason ? (
                          <span className="ad-note">{reason}</span>
                        ) : (
                          <Button
                            variant={user.locked ? "secondary" : "danger"}
                            busy={lock.isPending && lock.variables?.id === user.id}
                            aria-label={`${user.locked ? "Mở khóa" : "Khóa"} ${user.email}`}
                            onClick={() => void toggleLock(user)}
                          >
                            {user.locked ? "Mở khóa" : "Khóa"}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <AdminPager
              label="Phân trang người dùng" summary={`${data.total} tài khoản`}
              page={page} total={data.total} pageSize={PAGE_SIZE} onPageChange={setPage}
            />
          </>
        )}
      </Card>
      <Toast message={toast} onDone={clearToast} />
    </section>
  );
}

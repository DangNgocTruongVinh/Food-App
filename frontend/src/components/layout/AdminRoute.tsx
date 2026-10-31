import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { isAdmin } from "../../features/layout/layout.logic";

/** Chỉ tài khoản ADMIN vào được các trang /admin (backend vẫn kiểm tra quyền ở mọi API). */
export function AdminRoute() {
  const { user } = useAuth();
  return isAdmin(user) ? <Outlet /> : <Navigate to="/dashboard" replace />;
}

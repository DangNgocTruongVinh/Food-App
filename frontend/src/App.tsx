import { lazy, Suspense } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { AdminRoute } from "./components/layout/AdminRoute";
import ScrollToTop from "./components/ScrollToTop";
import AppLayout from "./layouts/AppLayout";
import PublicLayout from "./layouts/PublicLayout";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import { getAuthToken } from "./features/auth/auth.storage";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Tách gói theo route (ra-soat-cuoi): chỉ Trang chủ và Đăng nhập nằm trong gói chính (trang vào đầu tiên, không nháy);
// mọi trang khác tải khi mở. Suspense đặt quanh <Routes> (fallback rỗng như các trang lazy trước đây).
const AiAssistantPage = lazy(() => import("./pages/AiAssistantPage"));
const CommunityPage = lazy(() => import("./pages/CommunityPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const FavoriteRecipesPage = lazy(() => import("./pages/FavoriteRecipesPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const UnsubscribeExpiryPage = lazy(() => import("./pages/UnsubscribeExpiryPage"));
const MealPlansPage = lazy(() => import("./pages/MealPlansPage"));
const PantryPage = lazy(() => import("./pages/PantryPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const RecipeDetailPage = lazy(() => import("./pages/RecipeDetailPage"));
const RecipesPage = lazy(() => import("./pages/RecipesPage"));
const PrivacyPage = lazy(() => import("./pages/info/PrivacyPage"));
const TermsPage = lazy(() => import("./pages/info/TermsPage"));

// Trang mẫu thành phần giao diện: chỉ có ở môi trường dev (bản build production loại bỏ cả route lẫn mã của trang).
// Trang Quản trị (kèm Recharts) chỉ Admin dùng: tải riêng để không làm nặng gói của người dùng thường.
// Báo cáo dùng Recharts (nặng): tải riêng khi mở trang, không nằm trong gói chính.
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const AdminLayout = lazy(() => import("./layouts/AdminLayout"));
const AdminStatsPage = lazy(() => import("./pages/admin/AdminStatsPage"));
const AdminRecipesPage = lazy(() => import("./pages/admin/AdminRecipesPage"));
const AdminRecipeEditorPage = lazy(() => import("./pages/admin/AdminRecipeEditorPage"));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage"));
const AdminModerationPage = lazy(() => import("./pages/admin/AdminModerationPage"));
const AdminAuditLogsPage = lazy(() => import("./pages/admin/AdminAuditLogsPage"));
const DevUiPage = import.meta.env.DEV ? lazy(() => import("./pages/dev/DevUiPage")) : null;

function ProtectedRoute() {
  return getAuthToken() ? <Outlet /> : <Navigate to="/login" replace />;
}

export default function App() {
  const { pathname } = useLocation();
  return <>
    <ScrollToTop />
    <ErrorBoundary key={pathname}>
    <Suspense fallback={null}>
    <Routes>
      <Route index element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/tat-nhac-han" element={<UnsubscribeExpiryPage />} />
      <Route element={<PublicLayout />}>
        <Route path="privacy" element={<PrivacyPage />} />
        <Route path="terms" element={<TermsPage />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="pantry" element={<PantryPage />} />
          <Route path="meal-plans" element={<MealPlansPage />} />
          <Route path="meal-plans/:id" element={<MealPlansPage />} />
          <Route path="recipes" element={<RecipesPage />} />
          <Route path="recipes/favorites" element={<FavoriteRecipesPage />} />
          <Route path="recipes/:id" element={<RecipeDetailPage />} />
          <Route path="community" element={<CommunityPage />} />
          <Route path="assistant" element={<AiAssistantPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="reports" element={<ReportsPage />} />
        </Route>
        {/* Khu Quản trị tách riêng khung (AdminLayout), không dùng menu/footer của người dùng; USER vào /admin → Tổng quan. */}
        <Route element={<AdminRoute />}>
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<AdminStatsPage />} />
            <Route path="recipes" element={<AdminRecipesPage />} />
            <Route path="recipes/new" element={<AdminRecipeEditorPage />} />
            <Route path="recipes/:id/edit" element={<AdminRecipeEditorPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="moderation" element={<AdminModerationPage />} />
            <Route path="audit-logs" element={<AdminAuditLogsPage />} />
          </Route>
        </Route>
      </Route>
      {DevUiPage && <Route path="/dev/ui" element={<DevUiPage />} />}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
    </ErrorBoundary>
  </>;
}

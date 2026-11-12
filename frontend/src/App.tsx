import { lazy, Suspense } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AdminRoute } from "./components/layout/AdminRoute";
import ScrollToTop from "./components/ScrollToTop";
import AppLayout from "./layouts/AppLayout";
import PublicLayout from "./layouts/PublicLayout";
import AiAssistantPage from "./pages/AiAssistantPage";
import CommunityPage from "./pages/CommunityPage";
import DashboardPage from "./pages/DashboardPage";
import LandingPage from "./pages/LandingPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import LoginPage from "./pages/LoginPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import UnsubscribeExpiryPage from "./pages/UnsubscribeExpiryPage";
import MealPlansPage from "./pages/MealPlansPage";
import PantryPage from "./pages/PantryPage";
import ProfilePage from "./pages/ProfilePage";
import RecipeDetailPage from "./pages/RecipeDetailPage";
import RecipesPage from "./pages/RecipesPage";
import PrivacyPage from "./pages/info/PrivacyPage";
import TermsPage from "./pages/info/TermsPage";
import { getAuthToken } from "./features/auth/auth.storage";

// Trang mẫu thành phần giao diện: chỉ có ở môi trường dev (bản build production loại bỏ cả route lẫn mã của trang).
// Trang Quản trị (kèm Recharts) chỉ Admin dùng: tải riêng để không làm nặng gói của người dùng thường.
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
  return <>
    <ScrollToTop />
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
          <Route path="recipes/:id" element={<RecipeDetailPage />} />
          <Route path="community" element={<CommunityPage />} />
          <Route path="assistant" element={<AiAssistantPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
        {/* Khu Quản trị tách riêng khung (AdminLayout), không dùng menu/footer của người dùng; USER vào /admin → Tổng quan. */}
        <Route element={<AdminRoute />}>
          <Route path="admin" element={<Suspense fallback={null}><AdminLayout /></Suspense>}>
            <Route index element={<Suspense fallback={null}><AdminStatsPage /></Suspense>} />
            <Route path="recipes" element={<Suspense fallback={null}><AdminRecipesPage /></Suspense>} />
            <Route path="recipes/new" element={<Suspense fallback={null}><AdminRecipeEditorPage /></Suspense>} />
            <Route path="recipes/:id/edit" element={<Suspense fallback={null}><AdminRecipeEditorPage /></Suspense>} />
            <Route path="users" element={<Suspense fallback={null}><AdminUsersPage /></Suspense>} />
            <Route path="moderation" element={<Suspense fallback={null}><AdminModerationPage /></Suspense>} />
            <Route path="audit-logs" element={<Suspense fallback={null}><AdminAuditLogsPage /></Suspense>} />
          </Route>
        </Route>
      </Route>
      {DevUiPage && <Route path="/dev/ui" element={<Suspense fallback={null}><DevUiPage /></Suspense>} />}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </>;
}

import { lazy, Suspense } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AdminRoute } from "./components/layout/AdminRoute";
import ScrollToTop from "./components/ScrollToTop";
import AppLayout from "./layouts/AppLayout";
import PublicLayout from "./layouts/PublicLayout";
import AdminHomePage from "./pages/admin/AdminHomePage";
import AiAssistantPage from "./pages/AiAssistantPage";
import CommunityPage from "./pages/CommunityPage";
import DashboardPage from "./pages/DashboardPage";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import MealPlansPage from "./pages/MealPlansPage";
import PantryPage from "./pages/PantryPage";
import ProfilePage from "./pages/ProfilePage";
import RecipeDetailPage from "./pages/RecipeDetailPage";
import RecipesPage from "./pages/RecipesPage";
import PrivacyPage from "./pages/info/PrivacyPage";
import TermsPage from "./pages/info/TermsPage";
import { getAuthToken } from "./features/auth/auth.storage";

// Trang mẫu thành phần giao diện: chỉ có ở môi trường dev (bản build production loại bỏ cả route lẫn mã của trang).
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
          <Route element={<AdminRoute />}>
            <Route path="admin" element={<AdminHomePage />} />
          </Route>
        </Route>
      </Route>
      {DevUiPage && <Route path="/dev/ui" element={<Suspense fallback={null}><DevUiPage /></Suspense>} />}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </>;
}

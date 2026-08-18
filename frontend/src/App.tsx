import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import AppLayout from "./layouts/AppLayout";
import AiAssistantPage from "./pages/AiAssistantPage";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import MealPlansPage from "./pages/MealPlansPage";
import PantryPage from "./pages/PantryPage";
import ProfilePage from "./pages/ProfilePage";
import RecipesPage from "./pages/RecipesPage";

function ProtectedRoute() {
  return localStorage.getItem("nutriplan_token") ? <Outlet /> : <Navigate to="/login" replace />;
}

export default function App() {
  const { user } = useAuth();
  return <Routes>
    <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
    <Route element={<ProtectedRoute />}>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="pantry" element={<PantryPage />} />
        <Route path="meal-plans" element={<MealPlansPage />} />
        <Route path="recipes" element={<RecipesPage />} />
        <Route path="assistant" element={<AiAssistantPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}

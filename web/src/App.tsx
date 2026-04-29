import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import HomePage from "./pages/public/HomePage";
import FeaturesPage from "./pages/public/FeaturesPage";
import PublicAboutPage from "./pages/public/AboutPage";
import BranchesPage from "./pages/public/BranchesPage";
import DownloadPage from "./pages/public/DownloadPage";
import LoginPage from "./pages/LoginPage";
import LoginOtpPage from "./pages/LoginOtpPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import SetPasswordPage from "./pages/SetPasswordPage";
import StaffAccountNoticePage from "./pages/StaffAccountNoticePage";
import DashboardLayout from "./components/DashboardLayout";
import DashboardPage from "./pages/DashboardPage";
import UsersPage from "./pages/UsersPage";
import OrderManagementPage from "./pages/OrderManagementPage";
import MachineMonitoringPage from "./pages/MachineMonitoringPage";
import DeliveryManagementPage from "./pages/DeliveryManagementPage";
import PredictiveInventoryPage from "./pages/PredictiveInventoryPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import AIChatSupportPage from "./pages/AIChatSupportPage";
import AnnouncementsPage from "./pages/AnnouncementsPage";
import DashboardAboutPage from "./pages/AboutPage";
import UnauthorizedPage from "./pages/UnauthorizedPage";
import NotFound from "./pages/NotFound";
import ProfilePage from "./pages/ProfilePage";
import { getSessionUser } from "./lib/session";

const queryClient = new QueryClient();

const RequireRole = ({ roles, children }: { roles: string[]; children: JSX.Element }) => {
  const user = getSessionUser();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/unauthorized" replace />;
  return children;
};

const RequireInternal = ({ children }: { children: JSX.Element }) => {
  const user = getSessionUser();
  if (!user) return <Navigate to="/login" replace />;
  if (!(user.role === "ADMIN" || user.role === "STAFF")) return <Navigate to="/unauthorized" replace />;
  return children;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/features" element={<FeaturesPage />} />
          <Route path="/about-public" element={<PublicAboutPage />} />
          <Route path="/branches-public" element={<BranchesPage />} />
          <Route path="/download" element={<DownloadPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/login-otp" element={<LoginOtpPage />} />
          <Route path="/signup" element={<StaffAccountNoticePage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/set-password" element={<SetPasswordPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          <Route
            element={
              <RequireInternal>
                <DashboardLayout />
              </RequireInternal>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route
              path="/users"
              element={
                <RequireRole roles={["ADMIN"]}>
                  <UsersPage />
                </RequireRole>
              }
            />
            <Route
              path="/orders"
              element={
                <RequireRole roles={["STAFF"]}>
                  <OrderManagementPage />
                </RequireRole>
              }
            />
            <Route
              path="/machines"
              element={
                <RequireRole roles={["ADMIN"]}>
                  <MachineMonitoringPage />
                </RequireRole>
              }
            />
            <Route path="/delivery" element={<DeliveryManagementPage />} />
            <Route path="/inventory" element={<PredictiveInventoryPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/chat-support" element={<AIChatSupportPage />} />
            <Route path="/announcements" element={<AnnouncementsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/about" element={<DashboardAboutPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

/** Main App component with routing and global providers */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { ThemeProvider } from "./contexts/theme-context";
import { AuthProvider } from "./contexts/auth-context";
import { NotificationProvider } from "./contexts/notification-context";
import { AccessibilityProvider } from "./contexts/accessibility-context";

import LandingPage from "./pages/landing-page";
import LoginPage from "./pages/login-page";
import ForgotPasswordPage from "./pages/forgot-password-page";
import ResetPasswordPage from "./pages/reset-password-page";
import UnauthorizedPage from "./pages/unauthorized-page";

import { DashboardLayout } from "./components/layout/dashboard-layout";
import NotFound from "./pages/not-found";
import DonorDashboard from "./pages/donor/donor-dashboard";
import PostDonation from "./pages/donor/post-donation";
import DonorDonations from "./pages/donor/donor-donations";
import DonorNotifications from "./pages/donor/donor-notifications";
import DonorImpact from "./pages/donor/donor-impact";
import DonorSettings from "./pages/donor/settings";
import AdminDashboard from "./pages/admin/admin-dashboard";
import UserManagement from "./pages/admin/user-management";
import VerificationPage from "./pages/admin/verification";
import SafetyRulesPage from "./pages/admin/safety-rules";
import AuditLogsPage from "./pages/admin/audit-logs";
import ActiveTasksPage from "./pages/admin/active-tasks";
import DonationAnalytics from "./pages/admin/donation-analytics";
import NgoDashboard from "./pages/ngo/ngo-dashboard";
import VolunteerDashboard from "./pages/volunteer/volunteer-dashboard";
import VolunteerPerformance from "./pages/admin/volunteer-performance";
import FoodSafetyCompliance from "./pages/admin/food-safety-compliance";
import VolunteerSettings from "./pages/volunteer/settings";
import AvailableMissions from "./pages/volunteer/available-missions";
import ActiveMission from "./pages/volunteer/active-mission";
import MissionHistory from "./pages/volunteer/mission-history";
import VolunteerNotifications from "./pages/volunteer/notifications";
import AccountPage from "./pages/account-page";
import { SettingsPage } from "./pages/settings-page";
import { NgoSettingsPage } from "./pages/ngo/settings-page";
import NgoNotifications from "./pages/ngo/notifications";
import { MyClaimsPage } from "./pages/ngo/my-claims";
import { NearbyDonationsPage } from "./pages/ngo/nearby-donations";
import { NgoFeedbackPage } from "./pages/ngo/feedback-page";
import { NgoImpactPage } from "./pages/ngo/impact-page";
import NgoFleetDashboard from "./pages/ngo/fleet";
import NgoImpactReport from "./pages/ngo/impact-report";
import { Toaster } from "./components/ui/toaster";
import { TooltipProvider } from "./components/ui/tooltip";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <AccessibilityProvider>
          <NotificationProvider>
            <TooltipProvider>
              <Toaster />
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
                  <Route path="/unauthorized" element={<UnauthorizedPage />} />

                  <Route path="/donor" element={<DashboardLayout requiredRole="donor" />}>
                    <Route index element={<DonorDashboard />} />
                    <Route path="post" element={<PostDonation />} />
                    <Route path="donations" element={<DonorDonations />} />
                    <Route path="notifications" element={<DonorNotifications />} />
                    <Route path="impact" element={<DonorImpact />} />
                    <Route path="reports" element={<DonationAnalytics />} />
                    <Route path="settings" element={<DonorSettings />} />
                  </Route>

                  <Route path="/ngo" element={<DashboardLayout requiredRole="ngo" />}>
                    <Route index element={<NgoDashboard />} />
                    <Route path="nearby" element={<NearbyDonationsPage />} />
                    <Route path="accepted" element={<MyClaimsPage />} />
                    <Route path="fleet" element={<NgoFleetDashboard />} />
                    <Route path="notifications" element={<NgoNotifications />} />
                    <Route path="feedback" element={<NgoFeedbackPage />} />
                    <Route path="impact" element={<NgoImpactPage />} />
                    <Route path="impact-report" element={<NgoImpactReport />} />
                    <Route path="settings" element={<NgoSettingsPage />} />
                  </Route>

                  <Route path="/admin" element={<DashboardLayout requiredRole="admin" />}>
                    <Route index element={<AdminDashboard />} />
                    <Route path="users" element={<UserManagement />} />
                    <Route path="verification" element={<VerificationPage />} />
                    <Route path="safety" element={<SafetyRulesPage />} />
                    <Route path="audit" element={<AuditLogsPage />} />
                    <Route path="tasks" element={<ActiveTasksPage />} />
                    <Route path="reports" element={<DonationAnalytics />} />
                    <Route path="volunteers" element={<VolunteerPerformance />} />
                    <Route path="food-safety" element={<FoodSafetyCompliance />} />
                    <Route path="impact-report" element={<NgoImpactReport />} />
                    <Route path="tracking" element={<AdminDashboard />} />
                    <Route path="notifications" element={<AdminDashboard />} />
                    <Route path="moderation" element={<AdminDashboard />} />
                  </Route>

                  <Route path="/volunteer" element={<DashboardLayout requiredRole="volunteer" />}>
                    <Route index element={<VolunteerDashboard />} />
                    <Route path="available" element={<AvailableMissions />} />
                    <Route path="active" element={<ActiveMission />} />
                    <Route path="history" element={<MissionHistory />} />
                    <Route path="notifications" element={<VolunteerNotifications />} />
                    <Route path="settings" element={<VolunteerSettings />} />
                  </Route>

                  <Route path="/volunteer/preview" element={<VolunteerDashboard />} />

                  <Route path="/account" element={<DashboardLayout />}>
                    <Route index element={<AccountPage />} />
                  </Route>

                  <Route path="/settings" element={<DashboardLayout />}>
                    <Route index element={<SettingsPage />} />
                  </Route>

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </NotificationProvider>
        </AccessibilityProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

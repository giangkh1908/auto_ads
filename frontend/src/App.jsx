import { useState } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import ErrorBoundary from "./components/common/ErrorBoundary/ErrorBoundary.jsx";
import ProtectedRoute from "./components/common/ProtectedRoute/ProtectedRoute.jsx";
import AdminRouteGuard from "./components/common/ProtectedRoute/AdminRouteGuard.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import { useAuth } from "./hooks/useAuth.js";
import Header from "./components/layout/Header/Header.jsx";
import AdminHeader from "./components/admin/AdminHeader/AdminHeader.jsx";
import AdminSidebar from "./components/admin/AdminSidebar/AdminSidebar.jsx";
import AuthModal from "./components/feature/Auth/AuthModal.jsx";
import Footer from "./components/layout/Footer/Footer.jsx";
import Sidebar from "./components/layout/Sidebar/Sidebar.jsx";
import Home from "./pages/Home/Home.jsx";
import Dashboard from "./pages/Dashboard/Dashboard.jsx";
import NotFound from "./pages/NotFound/NotFound.jsx";
import AccountManagement from "./pages/AccountManagement/AccountManagement.jsx";
import AdsManagement from "./pages/AdsManagement/AdsManagement.jsx";
import ArchiveAds from "./pages/ArchiveAds/ArchiveAds.jsx";
import Analytics from "./pages/Analytics/Analytics.jsx";
import AutomationRule from "./pages/AutomationRule/AutomationRule.jsx";
import ConnectPage from "./pages/ConnectPage/ConnectPage.jsx";
import ConnectAdAccount from "./pages/ConnectAdAccount/ConnectAdAccount.jsx";
import ServicePackage from "./pages/ServicePackage/ServicePackage.jsx";
import Order from "./pages/Order/Order.jsx";
import CheckOut from "./pages/CheckOut/CheckOut.jsx";
import Bank from "./pages/CheckOut/Bank/Bank.jsx";
import VerifyEmail from "./pages/VerifyEmail/VerifyEmail.jsx";
import ResetPassword from "./pages/ResetPassword/ResetPassword.jsx";
import Profile from "./pages/Profile/Profile.jsx";
import MyShop from "./pages/Shop/MyShop.jsx";
import Employee from "./pages/Shop/Employee.jsx";
import History from "./pages/Shop/History.jsx";
import UserManagementPage from "./pages/AdminPage/SystemAdmin/UserManagement/CustomerPage/CustomerPage.jsx";
import InternalPage from "./pages/AdminPage/SystemAdmin/UserManagement/InternalPage/InternalPage.jsx";
import SystemLog from "./pages/AdminPage/SystemAdmin/SystemMonitoring/SystemLog/SystemLog.jsx";
import CustomerLog from "./pages/AdminPage/SystemAdmin/SystemMonitoring/CustomerLog/CustomerLog.jsx";
import PaymentManagement from "./pages/AdminPage/SystemAdmin/PaymentManagement/PaymentManagement.jsx";
import LeadPage from "./pages/AdminPage/CsStaff/LeadPage/LeadPage.jsx";
import ServicePackagePage from "./pages/AdminPage/CsStaff/ServicePackagePage/ServicePackagePage.jsx";
import PaymentPage from "./pages/AdminPage/CsStaff/PaymentPage/PaymentPage.jsx";
import TransactionsPage from "./pages/AdminPage/Accountant/TransactionsPage/TransactionsPage.jsx";
import ReportPage from "./pages/AdminPage/Accountant/ReportPage/ReportPage.jsx";
import ProtectedRouteForRole from "./components/common/ProtectedRoute/ProtectedRouteForRole.jsx";
import ScrollToTop from "./utils/ScrollToTop.jsx";
import { ROUTES, HEADER_ROUTES, AUTH_MODES } from "./constants/app.constants";

function AppContentInner() {
  const [authVisible, setAuthVisible] = useState(false);
  const [authMode, setAuthMode] = useState(AUTH_MODES.LOGIN);
  const location = useLocation();
  const { user } = useAuth();

  const handleLoginClick = () => {
    setAuthMode(AUTH_MODES.LOGIN);
    setAuthVisible(true);
  };

  // Logic kiểm tra hiển thị AdminHeader
  const shouldShowAdminHeader = (() => {
    const pathname = location.pathname;
    // Hiển thị khi route bắt đầu bằng /admin
    if (pathname.startsWith("/admin")) return true;
    // Hoặc khi user có internal_role và đang ở /profile
    if (pathname === "/profile" && user?.internal_role) return true;
    // Hoặc khi user có internal_role và đang ở Home
    if (pathname === "/" && user?.internal_role) return true;
    return false;
  })();

  // Logic kiểm tra header
  const shouldShowHeader = (() => {
    const pathname = location.pathname;
    // Ẩn Header mặc định trên các route admin
    if (pathname.startsWith("/admin")) return false;
    // Ẩn Header khi admin ở /profile (vì sẽ dùng AdminHeader)
    if (pathname === "/profile" && user?.internal_role) return false;
    // Ẩn Header khi admin ở Home (vì sẽ dùng AdminHeader)
    if (pathname === "/" && user?.internal_role) return false;
    // Exact match
    if (HEADER_ROUTES.includes(pathname)) {
      return true;
    }
    // Match shop employee và history routes (có shopId param)
    if (
      pathname.startsWith("/shop/employee/") ||
      pathname.startsWith("/shop/history/")
    ) {
      return true;
    }
    // Match các pattern routes khác
    return HEADER_ROUTES.some((route) => {
      if (route.includes(":")) {
        const regexPattern = "^" + route.replace(/:[^/]+/g, "[^/]+") + "$";
        return new RegExp(regexPattern).test(pathname);
      }
      return false;
    });
  })();

  return (
    <>
      {/* Hiển thị AdminHeader khi ở route admin hoặc admin ở profile */}
      {shouldShowAdminHeader && <AdminHeader />}
      {shouldShowHeader && <Header onLoginClick={handleLoginClick} />}
      <Routes>
        {/* Route cho Home */}
        <Route
          path={ROUTES.HOME}
          element={
            <>
              <main className="page-content">
                <Home onLoginClick={handleLoginClick} />
              </main>
              <Footer />
            </>
          }
        />

        {/* Admin - System Admin: Payment Management */}
        <Route
          path="/admin/system-admin/payment-management"
          element={
            <ProtectedRouteForRole allowedRole="System Admin">
              <main className="page-content">
                <PaymentManagement />
              </main>
            </ProtectedRouteForRole>
          }
        />

        {/* Admin - System Admin: User Management -> CustomerPage */}
        <Route
          path={ROUTES.ADMIN_SYSTEM_ADMIN_USER_MANAGEMENT}
          element={
            <ProtectedRouteForRole allowedRole="System Admin">
              <>
                <AdminSidebar />
                <main className="page-with-admin-sidebar">
                  <UserManagementPage />
                </main>
              </>
            </ProtectedRouteForRole>
          }
        />

        {/* Admin - System Admin: User Management -> Internal */}
        <Route
          path="/admin/system-admin/user-management/internal"
          element={
            <ProtectedRouteForRole allowedRole="System Admin">
              <>
                <AdminSidebar />
                <main className="page-with-admin-sidebar">
                  <InternalPage />
                </main>
              </>
            </ProtectedRouteForRole>
          }
        />

        {/* Admin - System Admin: System Monitoring -> SystemLog */}
        <Route
          path="/admin/system-admin/system-monitoring"
          element={
            <ProtectedRouteForRole allowedRole="System Admin">
              <>
                <AdminSidebar />
                <main className="page-with-admin-sidebar">
                  <SystemLog />
                </main>
              </>
            </ProtectedRouteForRole>
          }
        />

        {/* Admin - System Admin: System Monitoring -> CustomerLog */}
        <Route
          path="/admin/system-admin/system-monitoring/customer-log"
          element={
            <ProtectedRouteForRole allowedRole="System Admin">
              <>
                <AdminSidebar />
                <main className="page-with-admin-sidebar">
                  <CustomerLog />
                </main>
              </>
            </ProtectedRouteForRole>
          }
        />

        {/* Admin - CS Staff: Leads */}
        <Route
          path="/admin/cs-staff/leads"
          element={
            <ProtectedRouteForRole allowedRole="CS Staff">
              <main className="page-content">
                <LeadPage />
              </main>
            </ProtectedRouteForRole>
          }
        />

        {/* Admin - CS Staff: Service Package */}
        <Route
          path="/admin/cs-staff/service-package"
          element={
            <ProtectedRouteForRole allowedRole="CS Staff">
              <main className="page-content">
                <ServicePackagePage />
              </main>
            </ProtectedRouteForRole>
          }
        />

        {/* Admin - CS Staff: Payment */}
        <Route
          path="/admin/cs-staff/payment"
          element={
            <ProtectedRouteForRole allowedRole="CS Staff">
              <main className="page-content">
                <PaymentPage />
              </main>
            </ProtectedRouteForRole>
          }
        />

        {/* Admin - Accountant: Transactions */}
        <Route
          path="/admin/accountant/transactions"
          element={
            <ProtectedRouteForRole allowedRole="Accountant">
              <main className="page-content">
                <TransactionsPage />
              </main>
            </ProtectedRouteForRole>
          }
        />

        {/* Admin - Accountant: Reports */}
        <Route
          path="/admin/accountant/reports"
          element={
            <ProtectedRouteForRole allowedRole="Accountant">
              <main className="page-content">
                <ReportPage />
              </main>
            </ProtectedRouteForRole>
          }
        />

        {/* Route cho Dashboard */}
        <Route
          path={ROUTES.DASHBOARD}
          element={
            <AdminRouteGuard>
              <ProtectedRoute>
                <main className="page-content">
                  <Dashboard />
                </main>
              </ProtectedRoute>
            </AdminRouteGuard>
          }
        />

        {/* Route cho Account Management */}
        <Route
          path={ROUTES.ACCOUNT_MANAGEMENT}
          element={
            <AdminRouteGuard>
              <ProtectedRoute>
                <>
                  <main className="page-with-sidebar">
                    <AccountManagement />
                  </main>
                  <Sidebar />
                </>
              </ProtectedRoute>
            </AdminRouteGuard>
          }
        />

        {/* Route cho Ads Management */}
        <Route
          path={ROUTES.ADS_MANAGEMENT}
          element={
            <AdminRouteGuard>
              <ProtectedRoute>
                <>
                  <main className="page-with-sidebar">
                    <AdsManagement />
                  </main>
                  <Sidebar />
                </>
              </ProtectedRoute>
            </AdminRouteGuard>
          }
        />

        {/* Route cho Archive Ads */}
        <Route
          path={ROUTES.ARCHIVE_ADS}
          element={
            <AdminRouteGuard>
              <ProtectedRoute>
                <>
                  <main className="page-with-sidebar">
                    <ArchiveAds />
                  </main>
                  <Sidebar />
                </>
              </ProtectedRoute>
            </AdminRouteGuard>
          }
        />

        {/* Route cho Analytics */}
        <Route
          path={ROUTES.ANALYTICS}
          element={
            <AdminRouteGuard>
              <ProtectedRoute>
                <main className="page-content">
                  <Analytics />
                </main>
              </ProtectedRoute>
            </AdminRouteGuard>
          }
        />

        {/* Route cho Automation Rule */}
        <Route
          path={ROUTES.AUTOMATION_RULE}
          element={
            <AdminRouteGuard>
              <ProtectedRoute>
                <main className="page-content">
                  <AutomationRule />
                </main>
              </ProtectedRoute>
            </AdminRouteGuard>
          }
        />

        {/* Route cho Profile */}
        <Route
          path={ROUTES.PROFILE}
          element={
            <ProtectedRoute>
              <main className="page-content">
                <Profile />
              </main>
            </ProtectedRoute>
          }
        />

        {/* Routes cho Shop */}
        <Route
          path={ROUTES.SHOP}
          element={
            <AdminRouteGuard>
              <ProtectedRoute>
                <main className="page-content">
                  <MyShop />
                </main>
              </ProtectedRoute>
            </AdminRouteGuard>
          }
        />
        <Route
          path={ROUTES.SHOP_EMPLOYEE}
          element={
            <AdminRouteGuard>
              <ProtectedRoute>
                <main className="page-content">
                  <Employee />
                </main>
              </ProtectedRoute>
            </AdminRouteGuard>
          }
        />
        <Route
          path={ROUTES.SHOP_HISTORY}
          element={
            <AdminRouteGuard>
              <ProtectedRoute>
                <main className="page-content">
                  <History />
                </main>
              </ProtectedRoute>
            </AdminRouteGuard>
          }
        />

        {/* Route cho Service Package */}
        <Route
          path={ROUTES.SERVICE_PACKAGE}
          element={
            <AdminRouteGuard>
              <>
                <main className="page-content">
                  <ServicePackage />
                </main>
                <Footer />
              </>
            </AdminRouteGuard>
          }
        />

        {/* Route cho Order */}
        <Route
          path={ROUTES.ORDER}
          element={
            <AdminRouteGuard>
              <ProtectedRoute>
                <main className="page-content">
                  <Order />
                </main>
              </ProtectedRoute>
            </AdminRouteGuard>
          }
        />

        {/* Route cho CheckOut */}
        <Route
          path={ROUTES.CHECKOUT}
          element={
            <AdminRouteGuard>
              <ProtectedRoute>
                <main className="page-content">
                  <CheckOut />
                </main>
              </ProtectedRoute>
            </AdminRouteGuard>
          }
        />

        {/* Route cho CheckOut Bank */}
        <Route
          path={ROUTES.CHECKOUT_BANK}
          element={
            <AdminRouteGuard>
              <ProtectedRoute>
                <main className="page-content">
                  <Bank />
                </main>
              </ProtectedRoute>
            </AdminRouteGuard>
          }
        />

        {/* Route cho Connect Page */}
        <Route 
          path={ROUTES.CONNECT_PAGE} 
          element={
            <AdminRouteGuard>
              <ConnectPage />
            </AdminRouteGuard>
          } 
        />

        {/* Route cho Connect Ad Account */}
        <Route
          path={ROUTES.CONNECT_AD_ACCOUNT}
          element={
            <AdminRouteGuard>
              <ConnectAdAccount />
            </AdminRouteGuard>
          }
        />

        {/* Auth routes */}
        <Route
          path={ROUTES.VERIFY_EMAIL}
          element={
            <main className="auth-page">
              <VerifyEmail />
            </main>
          }
        />

        {/* Route cho Reset Password */}
        <Route
          path={ROUTES.RESET_PASSWORD}
          element={
            <main className="auth-page">
              <ResetPassword />
            </main>
          }
        />

        {/* Route cho NotFound */}
        <Route path={ROUTES.NOT_FOUND} element={<NotFound />} />
      </Routes>

      {authVisible && (
        <AuthModal
          visible={authVisible}
          mode={authMode}
          onClose={() => setAuthVisible(false)}
          onChangeMode={setAuthMode}
        />
      )}
    </>
  );
}

function AppContent() {
  return (
    <AuthProvider>
      <ScrollToTop />
      <AppContentInner />
      <Toaster
        richColors
        position="top-right"
        expand={true}
        duration={4000}
        closeButton={true}
        limit={2}
        offset="20px"
      />
    </AuthProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;

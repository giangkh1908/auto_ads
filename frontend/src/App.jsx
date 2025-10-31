import { useState } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import ErrorBoundary from './components/common/ErrorBoundary/ErrorBoundary.jsx'
import ProtectedRoute from './components/common/ProtectedRoute/ProtectedRoute.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'
import Header from './components/layout/Header/Header.jsx'
import AuthModal from './components/feature/Auth/AuthModal.jsx'
import Footer from './components/layout/Footer/Footer.jsx'
import Sidebar from './components/layout/Sidebar/Sidebar.jsx'
import Home from './pages/Home/Home.jsx'
import Dashboard from './pages/Dashboard/Dashboard.jsx'
import NotFound from './pages/NotFound/NotFound.jsx'
import AccountManagement from './pages/AccountManagement/AccountManagement.jsx'
import AdsManagement from './pages/AdsManagement/AdsManagement.jsx'
import ConnectPage from './pages/ConnectPage/ConnectPage.jsx'
import ConnectAdAccount from './pages/ConnectAdAccount/ConnectAdAccount.jsx'
import ServicePackage from './pages/ServicePackage/ServicePackage.jsx'
import Order from './pages/Order/Order.jsx'
import CheckOut from './pages/CheckOut/CheckOut.jsx'
import Bank from './pages/CheckOut/Bank/Bank.jsx'
import VerifyEmail from './pages/VerifyEmail/VerifyEmail.jsx'
import ResetPassword from './pages/ResetPassword/ResetPassword.jsx'
import Profile from './pages/Profile/Profile.jsx'
import MyShop from './pages/Shop/MyShop.jsx'
import Employee from './pages/Shop/Employee.jsx'
import History from './pages/Shop/History.jsx'
import ScrollToTop from './utils/ScrollToTop.jsx'
import { ROUTES, HEADER_ROUTES, AUTH_MODES } from './constants/app.constants'

function AppContent() {
  const [authVisible, setAuthVisible] = useState(false)
  const [authMode, setAuthMode] = useState(AUTH_MODES.LOGIN)
  // const navigate = useNavigate()
  const location = useLocation()

  const handleLoginClick = () => {
    setAuthMode(AUTH_MODES.LOGIN)
    setAuthVisible(true)
  }

  const shouldShowHeader = HEADER_ROUTES.includes(location.pathname)

  return (
    <>
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

        {/* Route cho Dashboard */}
        <Route 
          path={ROUTES.DASHBOARD}
          element={
            <ProtectedRoute>
              <main className="page-content">
                <Dashboard />
              </main>
            </ProtectedRoute>
          } 
        />

        {/* Route cho Account Management */}
        <Route 
          path={ROUTES.ACCOUNT_MANAGEMENT}
          element={
            <ProtectedRoute>
              <>
                <main className="page-with-sidebar">
                  <AccountManagement />
                </main>
                <Sidebar />
              </>
            </ProtectedRoute>
          } 
        />

        {/* Route cho Ads Management */}
        <Route 
          path={ROUTES.ADS_MANAGEMENT}
          element={
            <ProtectedRoute>
              <>
                <main className="page-with-sidebar">
                  <AdsManagement />
                </main>
                <Sidebar />
              </>
            </ProtectedRoute>
          } 
        />

        {/* Route cho Report */}
        <Route 
          path={ROUTES.REPORTS}
          element={
            <ProtectedRoute>
              <>
                <main className="page-with-sidebar">
                  <div className="page-placeholder">
                    <h2>Báo cáo</h2>
                    <p>Chức năng đang được phát triển...</p>
                  </div>
                </main>
                <Sidebar />
              </>
            </ProtectedRoute>
          } 
        />

        {/* Route cho Stats */}
        <Route 
          path={ROUTES.STATS}
          element={
            <ProtectedRoute>
              <>
                <main className="page-with-sidebar">
                  <div className="page-placeholder">
                    <h2>Thống kê</h2>
                    <p>Chức năng đang được phát triển...</p>
                  </div>
                </main>
                <Sidebar />
              </>
            </ProtectedRoute>
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
            <ProtectedRoute>
              <main className="page-content">
                <MyShop />
              </main>
            </ProtectedRoute>
          } 
        />
        <Route 
          path={ROUTES.SHOP_EMPLOYEE}
          element={
            <ProtectedRoute>
              <main className="page-content">
                <Employee />
              </main>
            </ProtectedRoute>
          } 
        />
        <Route 
          path={ROUTES.SHOP_HISTORY}
          element={
            <ProtectedRoute>
              <main className="page-content">
                <History />
              </main>
            </ProtectedRoute>
          } 
        />
        <Route 
          path={ROUTES.SHOP_EMPLOYEE}
          element={
            <ProtectedRoute>
              <main className="page-content">
                <Employee />
              </main>
            </ProtectedRoute>
          } 
        />
        <Route 
          path={ROUTES.SHOP_HISTORY}
          element={
            <ProtectedRoute>
              <main className="page-content">
                <History />
              </main>
            </ProtectedRoute>
          } 
        />

        {/* Route cho Service Package */}
        <Route 
          path={ROUTES.SERVICE_PACKAGE}
          element={
            <>
              <main className="page-content">
                <ServicePackage />
              </main>
              <Footer />
            </>
          }
        />

        {/* Route cho Order */}
        <Route 
          path={ROUTES.ORDER}
          element={
            <ProtectedRoute>
              <main className="page-content">
                <Order />
              </main>
            </ProtectedRoute>
          }
        />

        {/* Route cho CheckOut */}
        <Route 
          path={ROUTES.CHECKOUT}
          element={
            <ProtectedRoute>
              <main className="page-content">
                <CheckOut />
              </main>
            </ProtectedRoute>
          }
        />

        {/* Route cho CheckOut Bank */}
        <Route 
          path={ROUTES.CHECKOUT_BANK}
          element={
            <ProtectedRoute>
              <main className="page-content">
                <Bank />
              </main>
            </ProtectedRoute>
          }
        />

        {/* Route cho Connect Page */}
        <Route 
          path={ROUTES.CONNECT_PAGE}
          element={<ConnectPage />}
        />

        {/* Route cho Connect Ad Account */}
        <Route 
          path={ROUTES.CONNECT_AD_ACCOUNT}
          element={<ConnectAdAccount />}
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
  )
}

function App() {
  return (
    <ErrorBoundary>
        <BrowserRouter>
          <AuthProvider>
            <ScrollToTop />
            <AppContent />
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
        </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
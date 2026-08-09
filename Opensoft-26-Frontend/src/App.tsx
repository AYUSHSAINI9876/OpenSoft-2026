import { Suspense, lazy, type ReactElement } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './components/ui/Toast'
import ErrorBoundary from './components/ui/ErrorBoundary'
import RouteFallback from './components/ui/RouteFallback'

// Route-level code splitting. The terminal alone pulls in lightweight-charts,
// so keeping it out of the entry chunk is what makes first paint fast for
// visitors who only ever see the landing or login pages.
const DesktopPage = lazy(() => import('./components/DesktopPage'))
const TerminalLayout = lazy(() => import('./components/TerminalLayout'))
const LoginPage = lazy(() => import('./components/LoginPage'))
const SignInPage = lazy(() => import('./components/SignInPage'))
const ForgotPasswordPage = lazy(() => import('./components/ForgotPasswordPage'))
const PortfolioPage = lazy(() => import('./components/PortfolioPage'))
const MarketsPage = lazy(() => import('./components/markets/MarketsPage').then((m) => ({ default: m.MarketsPage })))
const SettingsPage = lazy(() => import('./components/SettingsPage'))
const NotFoundPage = lazy(() => import('./components/NotFoundPage'))

/**
 * Gates authenticated pages. Unlike the previous version this remembers where
 * the user was heading, so signing in returns them there instead of always
 * dumping them on /portfolio.
 */
function ProtectedRoute({ children }: { children: ReactElement }) {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  return children
}

/** Keeps signed-in users off the login/signup screens. */
function AuthOnlyRoute({ children }: { children: ReactElement }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <Navigate to="/portfolio" replace /> : children
}

function HomeRoute() {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <Navigate to="/portfolio" replace /> : <DesktopPage />
}

function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/dashboard" element={<HomeRoute />} />
        <Route path="/signup" element={<AuthOnlyRoute><LoginPage /></AuthOnlyRoute>} />
        <Route path="/login" element={<AuthOnlyRoute><SignInPage /></AuthOnlyRoute>} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/markets" element={<MarketsPage />} />
        <Route path="/terminal" element={<TerminalLayout />} />
        <Route path="/trade" element={<TerminalLayout />} />
        <Route path="/portfolio" element={<ProtectedRoute><PortfolioPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  )
}

export default App

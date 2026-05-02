import type { ReactElement } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import TerminalLayout from './components/TerminalLayout'
import DesktopPage from './components/DesktopPage'
import LoginPage from './components/LoginPage'
import SignInPage from './components/SignInPage'
import ForgotPasswordPage from './components/ForgotPasswordPage'
import PortfolioPage from './components/PortfolioPage'
import { MarketsPage } from './components/markets/MarketsPage'
import SettingsPage from './components/SettingsPage'

const isAuthenticated = () => !!localStorage.getItem('token')

function ProtectedRoute({ children }: { children: ReactElement }) {
  return isAuthenticated() ? children : <Navigate to="/login" replace />
}

function AuthOnlyRoute({ children }: { children: ReactElement }) {
  return isAuthenticated() ? <Navigate to="/portfolio" replace /> : children
}

function HomeRoute() {
  return isAuthenticated() ? <Navigate to="/portfolio" replace /> : <DesktopPage />
}

function App() {
  return (
    <BrowserRouter>
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

import { CometDashboard } from '@/components/dashboard/CometDashboard'
import { LoginPage } from '@/components/auth/LoginPage'
import { isAuthenticated } from './auth'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'

function AuthenticatedShell() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setVisible(true))
    return () => window.cancelAnimationFrame(id)
  }, [])

  return (
    <div
      className="transition-all duration-500 ease-out"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
      }}
    >
      <CometDashboard />
    </div>
  )
}

function RequireAuth({ children }: { children: ReactElement }) {
  const location = useLocation()
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <AuthenticatedShell />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
import { CometDashboard } from '@/components/dashboard/CometDashboard'
import { LoginPage } from '@/components/auth/LoginPage'
import OnboardingPage from '@/pages/OnboardingPage'
import { isAuthenticated } from './auth'
import { useProfile } from '@/hooks/useProfile'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import type { ReactElement } from 'react'

const ONBOARDING_COMPLETE_KEY = 'cometbot_onboarding_complete'

function AuthenticatedShell() {
  const { profile, completedCourses } = useProfile()
  const [visible, setVisible] = useState(false)

  const needsOnboarding = useMemo(() => {
    try {
      if (localStorage.getItem(ONBOARDING_COMPLETE_KEY) === 'true') return false
    } catch {
      return false
    }
    return completedCourses.length === 0 && profile.semesters.length === 0
  }, [completedCourses.length, profile.semesters.length])

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setVisible(true))
    return () => window.cancelAnimationFrame(id)
  }, [])

  if (needsOnboarding) {
    return <Navigate to="/onboarding" replace />
  }

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
      <Route path="/onboarding" element={<OnboardingPage />} />
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
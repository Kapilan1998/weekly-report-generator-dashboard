import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AuthPage } from './pages/AuthPage'
import { MyReportsPage } from './pages/MyReportsPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { ProfilePage } from './pages/ProfilePage'
import { TeamDashboardPage } from './pages/TeamDashboardPage'
import { ProtectedRoute } from './routes/ProtectedRoute'

export default function App() {
  return (
    <Routes>
      {/*
        /login and /register are children of one AuthPage layout route on purpose: the
        parent element stays mounted across the navigation, which is what lets AuthPage
        slide between the two forms instead of being torn down and rebuilt. AuthPage reads
        the pathname to decide which form is showing.
      */}
      <Route element={<AuthPage />}>
        <Route path="/login" element={null} />
        <Route path="/register" element={null} />
      </Route>

      {/* Signed in: anything inside the app shell */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/reports" replace />} />
          <Route path="/reports" element={<MyReportsPage />} />
          <Route path="/profile" element={<ProfilePage />} />

          {/* Manager-only. The backend enforces this too - this only decides what renders. */}
          <Route element={<ProtectedRoute role="MANAGER" />}>
            <Route path="/team" element={<TeamDashboardPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}

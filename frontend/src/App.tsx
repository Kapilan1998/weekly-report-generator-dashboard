import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AuthPage } from './pages/AuthPage'
import { MemberProfilePage } from './pages/MemberProfilePage'
import { MyReportsPage } from './pages/MyReportsPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { ProfilePage } from './pages/ProfilePage'
import { ProjectsPage } from './pages/ProjectsPage'
import { ReportDetailPage } from './pages/ReportDetailPage'
import { ReportFormPage } from './pages/ReportFormPage'
import { ReviewPage } from './pages/ReviewPage'
import { SectionComparePage } from './pages/SectionComparePage'
import { TeamDashboardPage } from './pages/TeamDashboardPage'
import { UsersPage } from './pages/UsersPage'
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
          {/* Declared before /reports/:id so "new" is matched as a literal, not an id. */}
          <Route path="/reports/new" element={<ReportFormPage />} />
          <Route path="/reports/:id" element={<ReportDetailPage />} />
          <Route path="/reports/:id/edit" element={<ReportFormPage />} />
          <Route path="/profile" element={<ProfilePage />} />

          {/* Manager-only. The backend enforces this too - this only decides what renders. */}
          <Route element={<ProtectedRoute role="MANAGER" />}>
            <Route path="/team" element={<TeamDashboardPage />} />
            {/* Declared before /team/:userId so "sections" is matched as a literal. */}
            <Route path="/team/sections" element={<SectionComparePage />} />
            <Route path="/team/:userId" element={<MemberProfilePage />} />
            <Route path="/review/:reportId" element={<ReviewPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/admin/users" element={<UsersPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}

import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ToastProvider } from './components/ui/Toast'
import { Layout } from './components/Layout'
import { Gate, RequireRole } from './components/guards'
import { RootErrorBoundary } from './components/RootErrorBoundary'
import { Spinner } from './components/ui/Spinner'

import { Landing } from './pages/public/Landing'
import { Login } from './pages/public/Login'
import { Signup } from './pages/public/Signup'
import { ResetPassword } from './pages/public/ResetPassword'
import { Privacy } from './pages/public/Privacy'
import { NotFound } from './pages/public/NotFound'

import { Waiting } from './pages/shared/Waiting'
import { Disabled } from './pages/shared/Disabled'
import { Board } from './pages/shared/Board'
import { OfferDetail } from './pages/shared/OfferDetail'
import { Thread } from './pages/shared/Thread'
import { PersonProfile } from './pages/shared/PersonProfile'
import { Notifications } from './pages/shared/Notifications'
import { ProfileEdit } from './pages/shared/ProfileEdit'

import { StudentHome } from './pages/student/StudentHome'
import { MyRequests } from './pages/student/MyRequests'

import { MemberHome } from './pages/member/MemberHome'

// Member offer forms and the entire admin desk are split into their own chunks
// (React.lazy) so a student — the majority role, often on mobile — never
// downloads code they can't reach (review PERF-04). Named exports are adapted
// to the default export React.lazy expects.
const OfferForm = lazy(() => import('./pages/member/OfferForm').then((m) => ({ default: m.OfferForm })))
const OfferManage = lazy(() => import('./pages/member/OfferManage').then((m) => ({ default: m.OfferManage })))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })))
const AdminPeople = lazy(() => import('./pages/admin/AdminPeople').then((m) => ({ default: m.AdminPeople })))
const AdminOffers = lazy(() => import('./pages/admin/AdminOffers').then((m) => ({ default: m.AdminOffers })))
const AdminRequests = lazy(() => import('./pages/admin/AdminRequests').then((m) => ({ default: m.AdminRequests })))
const AdminReports = lazy(() => import('./pages/admin/AdminReports').then((m) => ({ default: m.AdminReports })))
const AdminAudit = lazy(() => import('./pages/admin/AdminAudit').then((m) => ({ default: m.AdminAudit })))

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => window.scrollTo(0, 0), [pathname])
  return null
}

/** Remount Thread per :id so its refs/messages never carry across threads. */
function ThreadRoute() {
  const { id } = useParams<{ id: string }>()
  return <Thread key={id} />
}

/** /home fans out by role — each role's landing view is different on purpose. */
function HomeSwitch() {
  const { profile } = useAuth()
  if (!profile) return null
  if (profile.role === 'member') return <MemberHome />
  if (profile.role === 'admin') return <Navigate to="/admin" replace />
  return <StudentHome />
}

export default function App() {
  return (
    <RootErrorBoundary>
      <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Suspense fallback={<Spinner page />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/privacy" element={<Privacy />} />

            <Route element={<Gate />}>
              <Route path="/waiting" element={<Waiting />} />
              <Route path="/disabled" element={<Disabled />} />
              <Route element={<Layout />}>
                <Route path="/home" element={<HomeSwitch />} />
                <Route path="/board" element={<Board />} />
                <Route path="/board/:id" element={<OfferDetail />} />
                <Route path="/requests" element={<RequireRole roles={['student']}><MyRequests /></RequireRole>} />
                <Route path="/requests/:id" element={<ThreadRoute />} />
                <Route path="/offers/new" element={<RequireRole roles={['member']}><OfferForm /></RequireRole>} />
                <Route path="/offers/:id/edit" element={<RequireRole roles={['member', 'admin']}><OfferForm /></RequireRole>} />
                <Route path="/offers/:id/manage" element={<RequireRole roles={['member', 'admin']}><OfferManage /></RequireRole>} />
                <Route path="/people/:id" element={<PersonProfile />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/profile" element={<ProfileEdit />} />
                <Route path="/admin" element={<RequireRole roles={['admin']}><AdminDashboard /></RequireRole>} />
                <Route path="/admin/people" element={<RequireRole roles={['admin']}><AdminPeople /></RequireRole>} />
                <Route path="/admin/offers" element={<RequireRole roles={['admin']}><AdminOffers /></RequireRole>} />
                <Route path="/admin/requests" element={<RequireRole roles={['admin']}><AdminRequests /></RequireRole>} />
                <Route path="/admin/reports" element={<RequireRole roles={['admin']}><AdminReports /></RequireRole>} />
                <Route path="/admin/audit" element={<RequireRole roles={['admin']}><AdminAudit /></RequireRole>} />
              </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
      </AuthProvider>
    </RootErrorBoundary>
  )
}

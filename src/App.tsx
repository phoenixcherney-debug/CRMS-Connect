import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ToastProvider } from './components/ui/Toast'
import { Layout } from './components/Layout'
import { Gate, RequireRole } from './components/guards'

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
import { OfferForm } from './pages/member/OfferForm'
import { OfferManage } from './pages/member/OfferManage'

import { AdminDashboard } from './pages/admin/AdminDashboard'
import { AdminPeople } from './pages/admin/AdminPeople'
import { AdminOffers } from './pages/admin/AdminOffers'
import { AdminRequests } from './pages/admin/AdminRequests'
import { AdminReports } from './pages/admin/AdminReports'
import { AdminAudit } from './pages/admin/AdminAudit'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => window.scrollTo(0, 0), [pathname])
  return null
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
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <ScrollToTop />
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
                <Route path="/requests/:id" element={<Thread />} />
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
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}

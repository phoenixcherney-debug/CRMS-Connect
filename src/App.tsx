import { lazy, Suspense, useLayoutEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'

// Disable browser scroll restoration so we control it ourselves
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual'
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

// Pages
const Explore           = lazy(() => import('./pages/Explore'))
const Feed              = lazy(() => import('./pages/Feed'))
const Jobs              = lazy(() => import('./pages/Jobs'))
const Events            = lazy(() => import('./pages/Events'))
const People            = lazy(() => import('./pages/People'))
const Employers         = lazy(() => import('./pages/Employers'))
const Notifications     = lazy(() => import('./pages/Notifications'))
const Login             = lazy(() => import('./pages/Login'))
const Signup            = lazy(() => import('./pages/Signup'))
const ResetPassword     = lazy(() => import('./pages/ResetPassword'))
const VerifyEmail       = lazy(() => import('./pages/VerifyEmail'))
const Onboarding        = lazy(() => import('./pages/Onboarding'))
const JobDetail         = lazy(() => import('./pages/JobDetail'))
const PostJob           = lazy(() => import('./pages/PostJob'))
const MyPostings        = lazy(() => import('./pages/MyPostings'))
const Applicants        = lazy(() => import('./pages/Applicants'))
const MyApplications    = lazy(() => import('./pages/MyApplications'))
const Availability      = lazy(() => import('./pages/Availability'))
const MyBookings        = lazy(() => import('./pages/MyBookings'))
const Messages          = lazy(() => import('./pages/Messages'))
const Conversation      = lazy(() => import('./pages/Conversation'))
const Profile           = lazy(() => import('./pages/Profile'))
const PublicProfile     = lazy(() => import('./pages/PublicProfile'))
const StudentPosts      = lazy(() => import('./pages/StudentPosts'))
const MyStudentPosts    = lazy(() => import('./pages/MyStudentPosts'))
const MeetingRequests   = lazy(() => import('./pages/MeetingRequests'))
const AdminPanel        = lazy(() => import('./pages/AdminPanel'))
const AdminUserView     = lazy(() => import('./pages/AdminUserView'))
const BannedPage        = lazy(() => import('./pages/BannedPage'))

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
      <AuthProvider>
        <ScrollToTop />
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-screen">
            <div className="w-10 h-10 border-[3px] rounded-full border-primary-muted border-t-primary animate-spin" />
          </div>
        }>
          <Routes>

            {/* ── Public ───────────────────────────────────────────────── */}
            <Route path="/login"          element={<Login />} />
            <Route path="/signup"         element={<Signup />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify-email"   element={<VerifyEmail />} />

            {/* ── Onboarding (auth required, onboarding check skipped) ── */}
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute skipOnboarding>
                  <Onboarding />
                </ProtectedRoute>
              }
            />

            {/* ── Nav pages (all authenticated) ────────────────────────── */}
            <Route path="/explore" element={
              <ProtectedRoute><Layout><Explore /></Layout></ProtectedRoute>
            } />
            <Route path="/feed" element={
              <ProtectedRoute><Layout><Feed /></Layout></ProtectedRoute>
            } />
            <Route path="/events" element={
              <ProtectedRoute><Layout><Events /></Layout></ProtectedRoute>
            } />
            <Route path="/people" element={
              <ProtectedRoute><Layout><People /></Layout></ProtectedRoute>
            } />
            <Route path="/notifications" element={
              <ProtectedRoute><Layout><Notifications /></Layout></ProtectedRoute>
            } />

            {/* ── Employers & Mentors (students only) ──────────────────── */}
            <Route path="/employers" element={
              <ProtectedRoute roles={['student']}>
                <Layout><Employers /></Layout>
              </ProtectedRoute>
            } />

            {/* ── Jobs / Opportunities ─────────────────────────────────── */}
            <Route path="/jobs" element={
              <ProtectedRoute><Layout><Jobs /></Layout></ProtectedRoute>
            } />
            <Route path="/jobs/:id" element={
              <ProtectedRoute><Layout><JobDetail /></Layout></ProtectedRoute>
            } />
            <Route path="/jobs/new" element={
              <ProtectedRoute roles={['employer_mentor']}>
                <Layout><PostJob /></Layout>
              </ProtectedRoute>
            } />
            <Route path="/jobs/:id/edit" element={
              <ProtectedRoute roles={['employer_mentor']}>
                <Layout><PostJob /></Layout>
              </ProtectedRoute>
            } />
            <Route path="/jobs/:id/applicants" element={
              <ProtectedRoute roles={['employer_mentor']}>
                <Layout><Applicants /></Layout>
              </ProtectedRoute>
            } />

            {/* ── Employer/mentor: my postings + student posts feed ────── */}
            <Route path="/my-postings" element={
              <ProtectedRoute roles={['employer_mentor']}>
                <Layout><MyPostings /></Layout>
              </ProtectedRoute>
            } />
            <Route path="/postings" element={
              <ProtectedRoute roles={['employer_mentor']}>
                <Layout><StudentPosts /></Layout>
              </ProtectedRoute>
            } />

            {/* ── Student: applications + my posts ─────────────────────── */}
            <Route path="/my-applications" element={
              <ProtectedRoute roles={['student']}>
                <Layout><MyApplications /></Layout>
              </ProtectedRoute>
            } />
            <Route path="/my-posts" element={
              <ProtectedRoute roles={['student']}>
                <Layout><MyStudentPosts /></Layout>
              </ProtectedRoute>
            } />

            {/* ── Availability / Bookings / Meetings ───────────────────── */}
            <Route path="/availability" element={
              <ProtectedRoute><Layout><Availability /></Layout></ProtectedRoute>
            } />
            <Route path="/my-bookings" element={
              <ProtectedRoute><Layout><MyBookings /></Layout></ProtectedRoute>
            } />
            <Route path="/meetings" element={
              <ProtectedRoute><Layout><MeetingRequests /></Layout></ProtectedRoute>
            } />

            {/* ── Inbox / Messages ─────────────────────────────────────── */}
            <Route path="/messages" element={
              <ProtectedRoute><Layout><Messages /></Layout></ProtectedRoute>
            } />
            <Route path="/messages/:id" element={
              <ProtectedRoute><Layout><Conversation /></Layout></ProtectedRoute>
            } />

            {/* ── Profile ──────────────────────────────────────────────── */}
            <Route path="/profile" element={
              <ProtectedRoute><Layout><Profile /></Layout></ProtectedRoute>
            } />
            <Route path="/people/:id" element={
              <ProtectedRoute><Layout><PublicProfile /></Layout></ProtectedRoute>
            } />

            {/* ── Banned (no ProtectedRoute — avoids redirect loop) ────── */}
            <Route path="/banned" element={<BannedPage />} />

            {/* ── Admin ─────────────────────────────────────────────────── */}
            <Route path="/admin" element={
              <ProtectedRoute roles={['admin']}>
                <Layout><AdminPanel /></Layout>
              </ProtectedRoute>
            } />
            <Route path="/admin/users/:id" element={
              <ProtectedRoute roles={['admin']}>
                <Layout><AdminUserView /></Layout>
              </ProtectedRoute>
            } />

            {/* ── Defaults ─────────────────────────────────────────────── */}
            <Route path="/"  element={<Navigate to="/explore" replace />} />
            <Route path="*"  element={<Navigate to="/explore" replace />} />

          </Routes>
        </Suspense>
      </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

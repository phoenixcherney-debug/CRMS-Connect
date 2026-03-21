import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'

// Pages
const Explore        = lazy(() => import('./pages/Explore'))
const Feed           = lazy(() => import('./pages/Feed'))
const Jobs           = lazy(() => import('./pages/Jobs'))
const Events         = lazy(() => import('./pages/Events'))
const People         = lazy(() => import('./pages/People'))
const Employers      = lazy(() => import('./pages/Employers'))
const Notifications  = lazy(() => import('./pages/Notifications'))
const Login          = lazy(() => import('./pages/Login'))
const Signup         = lazy(() => import('./pages/Signup'))
const ResetPassword  = lazy(() => import('./pages/ResetPassword'))
const Onboarding     = lazy(() => import('./pages/Onboarding'))
const JobDetail      = lazy(() => import('./pages/JobDetail'))
const PostJob        = lazy(() => import('./pages/PostJob'))
const MyPostings     = lazy(() => import('./pages/MyPostings'))
const Applicants     = lazy(() => import('./pages/Applicants'))
const MyApplications = lazy(() => import('./pages/MyApplications'))
const Messages       = lazy(() => import('./pages/Messages'))
const Conversation   = lazy(() => import('./pages/Conversation'))
const Profile        = lazy(() => import('./pages/Profile'))
const PublicProfile  = lazy(() => import('./pages/PublicProfile'))

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
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
            <Route path="/employers" element={
              <ProtectedRoute><Layout><Employers /></Layout></ProtectedRoute>
            } />
            <Route path="/notifications" element={
              <ProtectedRoute><Layout><Notifications /></Layout></ProtectedRoute>
            } />

            {/* ── Jobs ─────────────────────────────────────────────────── */}
            <Route path="/jobs" element={
              <ProtectedRoute><Layout><Jobs /></Layout></ProtectedRoute>
            } />
            <Route path="/jobs/:id" element={
              <ProtectedRoute><Layout><JobDetail /></Layout></ProtectedRoute>
            } />
            <Route path="/jobs/new" element={
              <ProtectedRoute roles={['alumni', 'parent']}>
                <Layout><PostJob /></Layout>
              </ProtectedRoute>
            } />
            <Route path="/jobs/:id/edit" element={
              <ProtectedRoute roles={['alumni', 'parent']}>
                <Layout><PostJob /></Layout>
              </ProtectedRoute>
            } />
            <Route path="/jobs/:id/applicants" element={
              <ProtectedRoute roles={['alumni', 'parent']}>
                <Layout><Applicants /></Layout>
              </ProtectedRoute>
            } />

            {/* ── My pages ─────────────────────────────────────────────── */}
            <Route path="/my-postings" element={
              <ProtectedRoute roles={['alumni', 'parent']}>
                <Layout><MyPostings /></Layout>
              </ProtectedRoute>
            } />
            <Route path="/my-applications" element={
              <ProtectedRoute roles={['student']}>
                <Layout><MyApplications /></Layout>
              </ProtectedRoute>
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

            {/* ── Defaults ─────────────────────────────────────────────── */}
            <Route path="/"  element={<Navigate to="/explore" replace />} />
            <Route path="*"  element={<Navigate to="/explore" replace />} />

          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}

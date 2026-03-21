import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'

// Pages
import Login from './pages/Login'
import Signup from './pages/Signup'
import ResetPassword from './pages/ResetPassword'
import Onboarding from './pages/Onboarding'
import Explore from './pages/Explore'
import Feed from './pages/Feed'
import Jobs from './pages/Jobs'
import JobDetail from './pages/JobDetail'
import PostJob from './pages/PostJob'
import MyPostings from './pages/MyPostings'
import Applicants from './pages/Applicants'
import MyApplications from './pages/MyApplications'
import Events from './pages/Events'
import People from './pages/People'
import UserProfile from './pages/UserProfile'
import Employers from './pages/Employers'
import Notifications from './pages/Notifications'
import Messages from './pages/Messages'
import Conversation from './pages/Conversation'
import Profile from './pages/Profile'
import MenuPage from './pages/MenuPage'
import RecoverAccount from './pages/RecoverAccount'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Post-signup onboarding — protected but skips onboarding redirect */}
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute skipOnboarding>
                <Onboarding />
              </ProtectedRoute>
            }
          />

          {/* Account recovery after soft-delete */}
          <Route
            path="/recover"
            element={
              <ProtectedRoute skipOnboarding skipRecover>
                <RecoverAccount />
              </ProtectedRoute>
            }
          />

          {/* Main pages (all authenticated users) */}
          <Route
            path="/explore"
            element={
              <ProtectedRoute>
                <Layout><Explore /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/feed"
            element={
              <ProtectedRoute>
                <Layout><Feed /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/jobs"
            element={
              <ProtectedRoute>
                <Layout><Jobs /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/jobs/:id"
            element={
              <ProtectedRoute>
                <Layout><JobDetail /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/events"
            element={
              <ProtectedRoute>
                <Layout><Events /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/people"
            element={
              <ProtectedRoute>
                <Layout><People /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/people/:id"
            element={
              <ProtectedRoute>
                <Layout><UserProfile /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/employers"
            element={
              <ProtectedRoute>
                <Layout><Employers /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <Layout><Notifications /></Layout>
              </ProtectedRoute>
            }
          />

          {/* Alumni & Parent only */}
          <Route
            path="/jobs/new"
            element={
              <ProtectedRoute roles={['alumni', 'parent']}>
                <Layout><PostJob /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/jobs/:id/edit"
            element={
              <ProtectedRoute roles={['alumni', 'parent']}>
                <Layout><PostJob /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-postings"
            element={
              <ProtectedRoute roles={['alumni', 'parent']}>
                <Layout><MyPostings /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/jobs/:id/applicants"
            element={
              <ProtectedRoute roles={['alumni', 'parent']}>
                <Layout><Applicants /></Layout>
              </ProtectedRoute>
            }
          />

          {/* Students only */}
          <Route
            path="/my-applications"
            element={
              <ProtectedRoute roles={['student']}>
                <Layout><MyApplications /></Layout>
              </ProtectedRoute>
            }
          />

          {/* Inbox (messaging) */}
          <Route
            path="/inbox"
            element={
              <ProtectedRoute>
                <Layout><Messages /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/inbox/:id"
            element={
              <ProtectedRoute>
                <Layout><Conversation /></Layout>
              </ProtectedRoute>
            }
          />

          {/* Profile */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Layout><Profile /></Layout>
              </ProtectedRoute>
            }
          />

          {/* Menu page */}
          <Route
            path="/menu"
            element={
              <ProtectedRoute>
                <Layout><MenuPage /></Layout>
              </ProtectedRoute>
            }
          />

          {/* Backwards compat: redirect /messages to /inbox */}
          <Route path="/messages/:id" element={<Navigate to="/inbox" replace />} />
          <Route path="/messages" element={<Navigate to="/inbox" replace />} />

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/explore" replace />} />
          <Route path="*" element={<Navigate to="/explore" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

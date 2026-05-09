import { lazy, Suspense, useEffect, useLayoutEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import ToastProvider from './components/ToastProvider'

/** NAV-002: rename redirects that need to preserve a dynamic :id param.
 *  Pass a template like "/opportunities/:id/edit" — :id is filled in from
 *  useParams. Append `?…` query strings get carried over by the router. */
function ParamRedirect({ to }: { to: string }) {
  const params = useParams()
  let dest = to
  for (const [key, val] of Object.entries(params)) {
    if (val) dest = dest.replace(`:${key}`, val)
  }
  return <Navigate to={dest} replace />
}

/** P1-12 — students hitting /student-posts (the EM-facing directory)
 *  used to bounce silently to /opportunities. Send them to their own
 *  /student-posts/mine instead so they see something coherent. */
function StudentPostsByRole({ DirectoryComponent }: { DirectoryComponent: React.ComponentType }) {
  const { profile, loading } = useAuth()
  if (loading) return null
  if (profile?.role === 'student') return <Navigate to="/student-posts/mine" replace />
  return <DirectoryComponent />
}

/** D.2 — top-level /people redirect that runs without waiting for auth.
 *  Previously this was role-aware (students → /mentors, EM → /students)
 *  but that needed `useAuth().loading` to settle, which produced a
 *  visible URL flicker for signed-out visitors going through the
 *  /login?next=/people round-trip. /students is reachable from /students
 *  → /mentors via the directory-toggle anyway, so the small UX loss
 *  buys us a flicker-free redirect at the route layer.
 */
function PeopleRedirect() {
  return <Navigate to="/students" replace />
}

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

// Per-route document.title so multi-tab users and screen readers can tell pages
// apart. Falls back to the default brand title.
const ROUTE_TITLES: Record<string, string> = {
  '/login': 'Sign in',
  '/signup': 'Create account',
  '/reset-password': 'Reset password',
  '/verify-email': 'Verify email',
  '/onboarding': 'Welcome',
  '/explore': 'Explore',
  '/activity': 'Activity',
  '/events': 'Events',
  '/people': 'People',
  '/students': 'Students',
  '/mentors': 'Mentors',
  '/notifications': 'Notifications',
  '/employers': 'Employers & Mentors',
  '/opportunities': 'Opportunities',
  '/opportunities/new': 'Post an Opportunity',
  '/my-opportunities': 'My Opportunities',
  '/student-posts': 'Student Posts',
  '/student-posts/mine': 'My Post',
  '/applications': 'Applications',
  '/saved': 'Saved',
  '/availability': 'Availability',
  '/my-bookings': 'My Bookings',
  '/meetings': 'Meetings',
  '/messages': 'Messages',
  '/profile': 'Profile',
  '/profile/edit': 'Edit profile',
  '/banned': 'Account suspended',
  '/admin': 'Admin Panel',
  '/admin/pending-accounts': 'Pending Accounts',
  '/admin/reports': 'Reports',
  '/awaiting-approval': 'Awaiting Approval',
  '/about': 'About',
  '/privacy': 'Privacy',
  '/contact': 'Contact',
}

function DocumentTitle() {
  const { pathname } = useLocation()
  useEffect(() => {
    const exact = ROUTE_TITLES[pathname]
    let title = exact
    if (!title) {
      // Match dynamic routes by their best-fitting prefix.
      if (pathname.startsWith('/opportunities/') && pathname.endsWith('/applicants')) title = 'Applicants'
      else if (pathname.startsWith('/opportunities/') && pathname.endsWith('/edit')) title = 'Edit opportunity'
      else if (pathname.startsWith('/opportunities/')) title = 'Opportunity'
      else if (pathname.startsWith('/messages/')) title = 'Conversation'
      else if (pathname.startsWith('/people/')) title = 'Profile'
      else if (pathname.startsWith('/admin/users/')) title = 'User · Admin'
    }
    // Catch-all paths fall through to NotFound — set the title here so the
    // browser tab matches the page (audit M6).
    if (!title && pathname !== '/' && !ROUTE_TITLES[pathname]) title = 'Page not found'
    document.title = title ? `${title} · CRMS Connect` : 'CRMS Connect'
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
const About             = lazy(() => import('./pages/About'))
const Privacy           = lazy(() => import('./pages/Privacy'))
const NotFound          = lazy(() => import('./pages/NotFound'))
const Contact           = lazy(() => import('./pages/Contact'))
const SavedJobs         = lazy(() => import('./pages/SavedJobs'))
const AwaitingApproval  = lazy(() => import('./pages/AwaitingApproval'))
const PendingAccounts   = lazy(() => import('./pages/PendingAccounts'))
const AdminReports      = lazy(() => import('./pages/AdminReports'))

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
      <AuthProvider>
      <ToastProvider>
        <ScrollToTop />
        <DocumentTitle />
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-screen">
            <div className="w-10 h-10 border-[3px] rounded-full border-primary-muted border-t-primary animate-spin" />
          </div>
        }>
          <Routes>

            {/* ── Public ───────────────────────────────────────────────── */}
            <Route path="/login"          element={<Login />} />
            {/* C.3 — dedicated /login/reset URL. Same component, mode is
                derived from pathname so deep-linking + browser-back work. */}
            <Route path="/login/reset"    element={<Login />} />
            <Route path="/signup"         element={<Signup />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify-email"   element={<VerifyEmail />} />
            <Route path="/about"          element={<Layout><About /></Layout>} />
            <Route path="/privacy"        element={<Layout><Privacy /></Layout>} />
            <Route path="/contact"        element={<Layout><Contact /></Layout>} />

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
            {/* NAV-002 — /activity is canonical; /feed redirects. */}
            <Route path="/activity" element={
              <ProtectedRoute><Layout><Feed /></Layout></ProtectedRoute>
            } />
            <Route path="/feed" element={<Navigate to="/activity" replace />} />
            <Route path="/events" element={
              <ProtectedRoute><Layout><Events /></Layout></ProtectedRoute>
            } />
            <Route path="/people" element={
              <ProtectedRoute><PeopleRedirect /></ProtectedRoute>
            } />
            <Route path="/students" element={
              <ProtectedRoute><Layout><People directory="students" /></Layout></ProtectedRoute>
            } />
            <Route path="/mentors" element={
              <ProtectedRoute><Layout><People directory="mentors" /></Layout></ProtectedRoute>
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

            {/* ── Opportunities (NAV-002 — canonical names; /jobs/* redirect) */}
            <Route path="/opportunities" element={
              <ProtectedRoute><Layout><Jobs /></Layout></ProtectedRoute>
            } />
            <Route path="/opportunities/new" element={
              <ProtectedRoute roles={['employer_mentor']}>
                <Layout><PostJob /></Layout>
              </ProtectedRoute>
            } />
            <Route path="/opportunities/:id" element={
              <ProtectedRoute><Layout><JobDetail /></Layout></ProtectedRoute>
            } />
            <Route path="/opportunities/:id/edit" element={
              <ProtectedRoute roles={['employer_mentor']}>
                <Layout><PostJob /></Layout>
              </ProtectedRoute>
            } />
            <Route path="/opportunities/:id/applicants" element={
              <ProtectedRoute roles={['employer_mentor']}>
                <Layout><Applicants /></Layout>
              </ProtectedRoute>
            } />
            {/* Legacy /jobs/* — preserve params via ParamRedirect. */}
            <Route path="/jobs"                    element={<Navigate to="/opportunities" replace />} />
            <Route path="/jobs/new"                element={<Navigate to="/opportunities/new" replace />} />
            <Route path="/jobs/:id"                element={<ParamRedirect to="/opportunities/:id" />} />
            <Route path="/jobs/:id/edit"           element={<ParamRedirect to="/opportunities/:id/edit" />} />
            <Route path="/jobs/:id/applicants"     element={<ParamRedirect to="/opportunities/:id/applicants" />} />

            {/* M-13 — nav copy used these labels but the routes 404'd. */}
            <Route path="/post-opportunity" element={<Navigate to="/opportunities/new" replace />} />
            <Route path="/my-post"          element={<Navigate to="/student-posts/mine" replace />} />

            {/* S2.7 — old /employers-mentors path used in earlier copy. */}
            <Route path="/employers-mentors" element={<Navigate to="/employers" replace />} />

            {/* ── Employer/mentor: my postings + student posts feed ────── */}
            <Route path="/my-opportunities" element={
              <ProtectedRoute roles={['employer_mentor']}>
                <Layout><MyPostings /></Layout>
              </ProtectedRoute>
            } />
            <Route path="/my-postings" element={<Navigate to="/my-opportunities" replace />} />
            <Route path="/student-posts" element={
              <ProtectedRoute>
                <Layout><StudentPostsByRole DirectoryComponent={StudentPosts} /></Layout>
              </ProtectedRoute>
            } />
            <Route path="/postings" element={<Navigate to="/student-posts" replace />} />

            {/* ── Student: applications + my posts ─────────────────────── */}
            <Route path="/applications" element={
              <ProtectedRoute roles={['student']}>
                <Layout><MyApplications /></Layout>
              </ProtectedRoute>
            } />
            {/* P2-37 — bookmarked opportunities. Open to any authed user. */}
            <Route path="/saved" element={
              <ProtectedRoute><Layout><SavedJobs /></Layout></ProtectedRoute>
            } />
            <Route path="/student-posts/mine" element={
              <ProtectedRoute roles={['student']}>
                <Layout><MyStudentPosts /></Layout>
              </ProtectedRoute>
            } />
            <Route path="/my-applications" element={<Navigate to="/applications" replace />} />
            <Route path="/my-posts" element={<Navigate to="/student-posts/mine" replace />} />

            {/* ── Availability / Bookings / Meetings ───────────────────── */}
            <Route path="/availability" element={
              <ProtectedRoute roles={['employer_mentor']}><Layout><Availability /></Layout></ProtectedRoute>
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
              <ProtectedRoute skipApprovalGate><Layout><Profile /></Layout></ProtectedRoute>
            } />

            {/* SEC-001 — holding page for pending EM accounts. */}
            <Route path="/awaiting-approval" element={
              <ProtectedRoute skipApprovalGate><AwaitingApproval /></ProtectedRoute>
            } />
            {/* Audit task 23 — bookmarkable edit URL. Profile reads
                useLocation().pathname and opens the edit form when it
                matches /profile/edit. */}
            <Route path="/profile/edit" element={
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
            {/* SEC-001 — staff approval queue for new employer/mentor signups. */}
            <Route path="/admin/pending-accounts" element={
              <ProtectedRoute roles={['admin']}>
                <Layout><PendingAccounts /></Layout>
              </ProtectedRoute>
            } />
            {/* SEC-003 — staff triage queue for user reports. */}
            <Route path="/admin/reports" element={
              <ProtectedRoute roles={['admin']}>
                <Layout><AdminReports /></Layout>
              </ProtectedRoute>
            } />

            {/* ── Legacy URL aliases (NAV-001 / NAV-002) ───────────────── */}
            {/* /inbox doesn't have a canonical replacement — /messages is canonical. */}
            <Route path="/inbox" element={<Navigate to="/messages" replace />} />

            {/* ── Defaults ─────────────────────────────────────────────── */}
            <Route path="/"  element={<Navigate to="/explore" replace />} />
            <Route path="*"  element={<Layout><NotFound /></Layout>} />

          </Routes>
        </Suspense>
      </ToastProvider>
      </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

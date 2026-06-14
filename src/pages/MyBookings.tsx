import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

// The bookings system has been replaced. /availability is employer/mentor-only,
// so send students to /meetings (where they see their requests) and everyone
// else to /availability — otherwise students double-redirect onto /opportunities.
export default function MyBookings() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  useEffect(() => {
    const dest = profile?.role === 'student' ? '/meetings' : '/availability'
    navigate(dest, { replace: true })
  }, [navigate, profile?.role])
  return null
}

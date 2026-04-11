import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

// The bookings system has been replaced with the personal availability calendar.
// Redirect any direct visits to /my-bookings → /availability.
export default function MyBookings() {
  const navigate = useNavigate()
  useEffect(() => { navigate('/availability', { replace: true }) }, [navigate])
  return null
}

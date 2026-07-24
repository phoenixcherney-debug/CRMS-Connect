import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/** Sign out and return to the public landing page. Shared by the header menu,
 *  the waiting/disabled screens, and the account-load error gate so the
 *  post-logout destination stays consistent (review nit A-04). */
export function useSignOut(): () => Promise<void> {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  return useCallback(async () => {
    await signOut()
    navigate('/')
  }, [signOut, navigate])
}

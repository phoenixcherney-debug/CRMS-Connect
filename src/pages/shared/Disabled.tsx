import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../../components/ui/Button'

export function Disabled() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-line bg-card p-8 text-center">
        <h1 className="text-2xl">This account is disabled</h1>
        <p className="mt-3 text-sm leading-relaxed text-faint">
          A CRMS staff member has disabled this account. If you think that's a mistake,
          contact the school's front office and ask for the Connect administrator.
        </p>
        <div className="mt-6">
          <Button variant="ghost" onClick={async () => { await signOut(); navigate('/') }}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  )
}

import { useNavigate } from 'react-router-dom'
import { Hourglass } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../../components/ui/Button'

/** The waiting room. Pending accounts land here — approval-by-a-real-person is
 *  the product's moat, so this page sells it instead of apologizing for it. */
export function Waiting() {
  const { profile, signOut, refreshProfile } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-line bg-card p-8 text-center">
        <Hourglass className="mx-auto h-8 w-8 text-clay" aria-hidden />
        <h1 className="mt-4 text-2xl">A real person is checking</h1>
        <p className="mt-3 text-sm leading-relaxed text-faint">
          {profile?.role === 'member' ? (
            <>Every adult on CRMS Connect is approved individually by school staff —
            that's why families trust what gets posted here. You'll get an email-free,
            in-app note the moment you're in. It's usually quick.</>
          ) : (
            <>Your account needs a quick look from CRMS staff (school-email accounts
            skip this). Check back soon.</>
          )}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="secondary" onClick={() => refreshProfile()}>
            Check again
          </Button>
          <Button variant="ghost" onClick={async () => { await signOut(); navigate('/') }}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  )
}

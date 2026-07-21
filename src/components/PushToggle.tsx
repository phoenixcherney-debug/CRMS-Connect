import { Bell, BellOff } from 'lucide-react'
import { usePush } from '../hooks/usePush'
import { Button } from './ui/Button'

/** Opt-in push control. Off by default; enabling always takes a deliberate
 *  click. Renders nothing when push isn't available or configured, so it never
 *  nags on a device that can't use it. */
export function PushToggle() {
  const { state, busy, error, enable, disable } = usePush()

  if (state === 'loading' || state === 'unsupported' || state === 'unconfigured') {
    return null
  }

  const on = state === 'on'

  return (
    <div className="rounded-xl border border-line bg-card p-5">
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${on ? 'bg-meadow text-pine' : 'bg-paper text-faint'}`}>
          {on ? <Bell className="h-5 w-5" aria-hidden /> : <BellOff className="h-5 w-5" aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg leading-snug">Push notifications</h2>
          {state === 'blocked' ? (
            <p className="mt-1 text-sm text-faint">
              Notifications are blocked for this site. Turn them back on in your browser's
              site settings, then reload.
            </p>
          ) : (
            <p className="mt-1 text-sm text-faint">
              {on
                ? 'On for this device — you\'ll get a push when someone raises a hand, replies, or staff approves something.'
                : 'Get a push on this device when there\'s something new. Off until you turn it on, and only on the devices you choose.'}
            </p>
          )}
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        </div>
        {state !== 'blocked' && (
          <Button
            variant={on ? 'secondary' : 'primary'}
            size="sm"
            loading={busy}
            onClick={on ? disable : enable}
          >
            {on ? 'Turn off' : 'Turn on'}
          </Button>
        )}
      </div>
    </div>
  )
}

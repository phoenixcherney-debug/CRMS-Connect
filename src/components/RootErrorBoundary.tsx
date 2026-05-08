import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Top-level boundary so a render exception in one page (e.g. the React #310
 * crash that wiped the entire chrome) shows a friendly recoverable fallback
 * instead of a blank white screen. Wrap the authenticated layout's content
 * outlet in this — the chrome (header, footer) stays intact.
 *
 * Logging: console.error today; swap in Sentry / Bugsnag here when wired up.
 */
export default class RootErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surfacing in console so it shows up in browser devtools and Vercel logs
    // alongside whatever React already printed.
    console.error('[RootErrorBoundary]', error, info.componentStack)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleHome = () => {
    // Force a navigation rather than router.push — we don't know what state
    // the router is in once a render threw.
    window.location.href = '/explore'
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="max-w-xl mx-auto py-12">
        <div
          className="bg-surface rounded-2xl border border-border p-6 text-center"
          style={{ boxShadow: 'var(--shadow-card)' }}
        >
          <AlertTriangle size={32} className="mx-auto text-error mb-3" />
          <h1
            className="text-lg font-bold text-ink mb-1"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            Something went wrong on this page
          </h1>
          <p className="text-sm text-ink-secondary mb-5">
            The error was logged. Try reloading, or head back to your dashboard.
          </p>
          <div className="flex gap-3 justify-center">
            <button type="button"
              onClick={this.handleReload}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-ink-secondary hover:bg-primary-faint transition-colors"
            >
              <RefreshCw size={14} /> Reload
            </button>
            <button type="button"
              onClick={this.handleHome}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-light transition-colors"
            >
              <ArrowLeft size={14} /> Back to dashboard
            </button>
          </div>
          {import.meta.env.DEV && (
            <pre className="mt-5 text-left text-xs text-ink-muted whitespace-pre-wrap overflow-auto max-h-48 p-3 rounded-lg border border-border bg-primary-faint">
              {this.state.error.message}
              {'\n'}
              {this.state.error.stack}
            </pre>
          )}
        </div>
      </div>
    )
  }
}

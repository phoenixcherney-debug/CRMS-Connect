import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

/** Last-resort boundary so a render error in one screen can't white-screen the
 *  whole app for everyone. Renders a recoverable fallback instead. */
export class RootErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-paper px-4">
        <div className="w-full max-w-md rounded-xl border border-line bg-card p-8 text-center">
          <h1 className="font-display text-2xl font-semibold text-ink">Something went sideways</h1>
          <p className="mt-3 text-sm leading-relaxed text-faint">
            This page hit an unexpected error. Reloading usually clears it.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <button
              onClick={() => { this.setState({ error: null }); window.location.assign('/home') }}
              className="rounded-lg bg-pine px-4 py-2 text-sm font-medium text-white hover:bg-pine-deep"
            >
              Back to the board
            </button>
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg border border-line-strong bg-card px-4 py-2 text-sm font-medium text-ink hover:border-pine"
            >
              Reload
            </button>
          </div>
        </div>
      </div>
    )
  }
}

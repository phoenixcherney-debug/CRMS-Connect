import BottomNav from './BottomNav'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
      {/* Branded top header */}
      <header
        className="fixed top-0 left-0 right-0 z-40"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          boxShadow: 'var(--shadow-header)',
        }}
      >
        <div
          className="hero-gradient h-14 flex items-center px-4 sm:px-6 gap-3 max-w-7xl mx-auto"
          style={{ maxWidth: '100%' }}
        >
          <img
            src="https://www.crms.org/wp-content/uploads/2020/09/Vector-Smart-Object-copy.png"
            alt="CRMS"
            className="h-8 w-auto object-contain shrink-0"
            style={{ filter: 'brightness(0) invert(1)' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
          <div className="h-5 w-px bg-white/25 shrink-0" />
          <span
            className="text-white font-bold text-base tracking-wide"
            style={{ letterSpacing: '0.04em' }}
          >
            Connect
          </span>
        </div>
      </header>

      <main
        className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8"
        style={{
          paddingTop: 'calc(3.5rem + env(safe-area-inset-top) + 1.25rem)',
          paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom))',
        }}
      >
        {children}
      </main>

      <BottomNav />
    </div>
  )
}

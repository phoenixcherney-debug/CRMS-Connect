import Nav from './Nav'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
      <Nav />
      <main
        className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8"
        style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}
      >
        {children}
      </main>
    </div>
  )
}

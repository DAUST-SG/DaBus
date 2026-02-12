import { ReactNode } from 'react'
import Header from './Header'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-surface-primary relative">
      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[400px] -left-[200px] w-[800px] h-[800px] rounded-full bg-[rgba(var(--accent),0.03)] blur-[120px]" />
        <div className="absolute -bottom-[300px] -right-[200px] w-[600px] h-[600px] rounded-full bg-[rgba(var(--accent),0.02)] blur-[100px]" />
      </div>

      <div className="relative z-10">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
        <footer className="border-t border-subtle mt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="font-display text-sm font-bold text-txt-muted">
                  Da<span className="text-gradient">Bus</span>
                </span>
              </div>
              <p className="text-txt-muted text-xs tracking-wide">
                DAUST Student Transportation
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}

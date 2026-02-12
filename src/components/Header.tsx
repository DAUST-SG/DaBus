import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'

export default function Header() {
  const { user, logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 glass-strong">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-accent to-accent-hover flex items-center justify-center shadow-glow transition-shadow group-hover:shadow-glow-lg">
              <svg className="w-5 h-5 text-surface-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h8m-8 4h8m-4 4v3m-6 0h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="font-display text-lg font-bold tracking-tight text-txt-primary">
              Da<span className="text-gradient">Bus</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {user ? (
              <>
                <span className="text-sm text-txt-muted px-3">
                  {user.full_name}
                </span>
                {user.role === 'admin' && (
                  <Link
                    href="/admin"
                    className="px-3 py-2 text-sm text-txt-secondary hover:text-accent rounded-lg hover:bg-[rgba(var(--accent),0.06)] transition-all duration-200"
                  >
                    Dashboard
                  </Link>
                )}
                <Link
                  href="/bookings"
                  className="px-3 py-2 text-sm text-txt-secondary hover:text-txt-primary rounded-lg hover:bg-[rgba(255,255,255,0.04)] transition-all duration-200"
                >
                  My Bookings
                </Link>
                <button
                  onClick={logout}
                  className="ml-2 px-4 py-2 text-sm text-[rgb(var(--danger))] rounded-lg hover:bg-[rgba(var(--danger),0.08)] transition-all duration-200"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="px-5 py-2 text-sm font-medium bg-gradient-to-r from-accent to-accent-hover text-surface-primary rounded-xl hover:shadow-glow transition-all duration-200"
              >
                Sign In
              </Link>
            )}
          </nav>

          {/* Mobile Toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg text-txt-secondary hover:bg-[rgba(255,255,255,0.06)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-subtle pb-4 animate-slide-down">
            {user ? (
              <div className="pt-3 space-y-1">
                <p className="px-3 py-2 text-sm text-txt-muted">{user.full_name}</p>
                {user.role === 'admin' && (
                  <Link
                    href="/admin"
                    onClick={() => setMobileOpen(false)}
                    className="block px-3 py-2 text-sm text-txt-secondary hover:text-accent rounded-lg hover:bg-[rgba(var(--accent),0.06)] transition-colors"
                  >
                    Dashboard
                  </Link>
                )}
                <Link
                  href="/bookings"
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2 text-sm text-txt-secondary hover:text-txt-primary rounded-lg hover:bg-[rgba(255,255,255,0.04)] transition-colors"
                >
                  My Bookings
                </Link>
                <button
                  onClick={() => { logout(); setMobileOpen(false) }}
                  className="w-full text-left px-3 py-2 text-sm text-[rgb(var(--danger))] rounded-lg hover:bg-[rgba(var(--danger),0.08)] transition-colors"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="pt-3">
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="block px-4 py-2.5 text-sm text-center font-medium bg-gradient-to-r from-accent to-accent-hover text-surface-primary rounded-xl"
                >
                  Sign In
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}

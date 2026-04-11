import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'

export default function Header() {
  const { user, logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 bg-black border-b-2 border-[rgba(255,255,255,0.1)] transition-all duration-300 hover:border-[rgba(var(--accent),0.3)]">
      <div className="max-w-7xl mx-auto px-6 sm:px-8">
        <div className="flex justify-between h-20 items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-4 group">
            <div className="w-10 h-10 bg-[rgb(var(--accent))] flex items-center justify-center skew-box shadow-[3px_3px_0_white] transition-transform duration-200 group-hover:-translate-y-1 group-hover:-translate-x-1 group-hover:shadow-[5px_5px_0_white]">
              <div className="unskew-text">
                <svg className="w-6 h-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
            <span className="font-display text-2xl font-bold tracking-widest text-white mt-1">
              DA<span className="text-[rgb(var(--accent))]">BUS</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6 font-display text-sm tracking-widest">
            {user ? (
              <>
                <span className="text-[rgb(var(--text-muted))]">
                  {user.full_name.toUpperCase()}
                </span>
                {user.role === 'admin' && (
                  <Link
                    href="/admin"
                    className="text-white relative hover:text-[rgb(var(--accent))] transition-colors after:content-[''] after:absolute after:-bottom-2 after:left-0 after:w-0 after:h-0.5 after:bg-[rgb(var(--accent))] hover:after:w-full after:transition-all"
                  >
                    DASHBOARD
                  </Link>
                )}
                <Link
                  href="/bookings"
                  className="text-white relative hover:text-[rgb(var(--accent))] transition-colors after:content-[''] after:absolute after:-bottom-2 after:left-0 after:w-0 after:h-0.5 after:bg-[rgb(var(--accent))] hover:after:w-full after:transition-all"
                >
                  MY BOOKINGS
                </Link>
                <button
                  onClick={logout}
                  className="text-[rgb(var(--danger))] hover:text-white transition-colors"
                >
                  LOGOUT
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="px-6 py-2.5 bg-[rgb(var(--accent))] text-black font-bold skew-box shadow-[3px_3px_0_white] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[5px_5px_0_white] hover:bg-white transition-all duration-200"
              >
                <div className="unskew-text">SIGN IN</div>
              </Link>
            )}
          </nav>

          {/* Mobile Toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden text-white hover:text-[rgb(var(--accent))] transition-colors"
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
          <div className="md:hidden border-t-2 border-[rgba(255,255,255,0.1)] py-4 font-display tracking-widest text-sm animate-slide-down">
            {user ? (
              <div className="flex flex-col gap-4">
                <p className="text-[rgb(var(--text-muted))]">{user.full_name.toUpperCase()}</p>
                {user.role === 'admin' && (
                  <Link
                    href="/admin"
                    onClick={() => setMobileOpen(false)}
                    className="text-white hover:text-[rgb(var(--accent))]"
                  >
                    DASHBOARD
                  </Link>
                )}
                <Link
                  href="/bookings"
                  onClick={() => setMobileOpen(false)}
                  className="text-white hover:text-[rgb(var(--accent))]"
                >
                  MY BOOKINGS
                </Link>
                <button
                  onClick={() => { logout(); setMobileOpen(false) }}
                  className="text-[rgb(var(--danger))] text-left hover:text-white"
                >
                  LOGOUT
                </button>
              </div>
            ) : (
              <div className="pt-2">
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="block w-full text-center py-3 bg-[rgb(var(--accent))] text-black font-bold skew-box"
                >
                  <div className="unskew-text">SIGN IN</div>
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}

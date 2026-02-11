import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'

export default function Header() {
  const { user, logout } = useAuth()

  return (
    <header className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold text-blue-600">
              SG BUS SHUTTLE
            </Link>
          </div>
          <nav className="flex items-center space-x-4">
            {user ? (
              <>
                <span className="text-gray-600">Welcome, {user.full_name}</span>
                {user.role === 'admin' && (
                  <Link href="/admin" className="text-blue-600 hover:text-blue-800">
                    Admin Dashboard
                  </Link>
                )}
                <Link href="/bookings" className="text-gray-600 hover:text-gray-900">
                  My Bookings
                </Link>
                <button
                  onClick={logout}
                  className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link href="/login" className="text-blue-600 hover:text-blue-800">
                Sign In
              </Link>
            )}
          </nav>
        </div>
      </div>
    </header>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/context/AuthContext'
import Button from '@/components/Button'

export default function LoginPage() {
  const router = useRouter()
  const { user, login, requestStudentMagicLink } = useAuth()
  const [adminForm, setAdminForm] = useState({
    email: '',
    password: '',
  })
  const [studentEmail, setStudentEmail] = useState('')
  const [adminLoading, setAdminLoading] = useState(false)
  const [studentLoading, setStudentLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [devMagicLink, setDevMagicLink] = useState<string | null>(null)

  const nextPath = useMemo(() => {
    const value = router.query.next
    if (typeof value !== 'string') {
      return '/'
    }
    return value.startsWith('/') && !value.startsWith('//') ? value : '/'
  }, [router.query.next])

  useEffect(() => {
    if (user) {
      router.replace(nextPath)
    }
  }, [user, router, nextPath])

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAdminLoading(true)
    setError(null)
    setNotice(null)
    setDevMagicLink(null)

    try {
      await login(adminForm)
      router.push(nextPath)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Admin login failed')
    } finally {
      setAdminLoading(false)
    }
  }

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStudentLoading(true)
    setError(null)
    setNotice(null)
    setDevMagicLink(null)

    try {
      const response = await requestStudentMagicLink(studentEmail, nextPath)
      if (response.delivered) {
        setNotice('Magic link sent. Check your inbox to continue booking.')
        return
      }

      setNotice('Email provider is not configured. Use the development sign-in link below.')
      if (response.dev_magic_link) {
        setDevMagicLink(response.dev_magic_link)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send magic link')
    } finally {
      setStudentLoading(false)
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-2xl">
        <h1 className="text-2xl font-bold text-center mb-2">Sign In</h1>
        <p className="text-center text-gray-600 mb-6">
          Students use magic link. Admins use password.
        </p>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        {notice && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {notice}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <form onSubmit={handleStudentSubmit} className="space-y-4 border rounded-lg p-5 bg-blue-50">
            <h2 className="font-semibold text-lg text-blue-900">Student Access</h2>
            <p className="text-sm text-blue-800">
              Allowed emails: <strong>@webmail.daust.org</strong> or <strong>@daust.org</strong>
            </p>
            <div>
              <label htmlFor="student-email" className="block text-sm font-medium text-gray-700 mb-1">
                Student Email
              </label>
              <input
                type="email"
                id="student-email"
                required
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={studentEmail}
                onChange={(e) => setStudentEmail(e.target.value)}
                placeholder="name@webmail.daust.org"
              />
            </div>
            <Button type="submit" loading={studentLoading} className="w-full">
              Send Magic Link
            </Button>
            {devMagicLink && (
              <a className="text-sm text-blue-700 underline break-all block" href={devMagicLink}>
                Open development magic link
              </a>
            )}
          </form>

          <form onSubmit={handleAdminSubmit} className="space-y-4 border rounded-lg p-5">
            <h2 className="font-semibold text-lg text-gray-900">Admin Access</h2>
            <div>
              <label htmlFor="admin-email" className="block text-sm font-medium text-gray-700 mb-1">
                Admin Email
              </label>
              <input
                type="email"
                id="admin-email"
                required
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={adminForm.email}
                onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                id="password"
                required
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={adminForm.password}
                onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
              />
            </div>
            <Button type="submit" loading={adminLoading} className="w-full">
              Sign In as Admin
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

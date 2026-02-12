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
    <div className="min-h-[80vh] flex items-center justify-center py-8">
      <div className="w-full max-w-2xl animate-scale-in">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-txt-primary mb-2">Welcome Back</h1>
          <p className="text-txt-muted">
            Students use magic link &middot; Admins use password
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-[rgba(var(--danger),0.1)] border border-[rgba(var(--danger),0.2)] text-[rgb(var(--danger))] text-sm animate-slide-down">
            {error}
          </div>
        )}
        {notice && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-[rgba(var(--success),0.1)] border border-[rgba(var(--success),0.2)] text-[rgb(var(--success))] text-sm animate-slide-down">
            {notice}
          </div>
        )}

        {/* Forms Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Student */}
          <form onSubmit={handleStudentSubmit} className="glass rounded-2xl p-6 gradient-border">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-accent" />
              <h2 className="font-display font-bold text-lg text-txt-primary">Student</h2>
            </div>
            <p className="text-xs text-txt-muted mb-5">
              Use your <span className="text-accent">@daust.org</span> email
            </p>

            <div className="space-y-4">
              <div>
                <label htmlFor="student-email" className="block text-xs font-medium text-txt-secondary mb-1.5">
                  Student Email
                </label>
                <input
                  type="email"
                  id="student-email"
                  required
                  className="input-dark"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  placeholder="name@webmail.daust.org"
                />
              </div>
              <Button type="submit" loading={studentLoading} className="w-full">
                Send Magic Link
              </Button>
              {devMagicLink && (
                <a className="text-xs text-accent hover:underline break-all block text-center" href={devMagicLink}>
                  Open development magic link
                </a>
              )}
            </div>
          </form>

          {/* Admin */}
          <form onSubmit={handleAdminSubmit} className="glass rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-txt-muted" />
              <h2 className="font-display font-bold text-lg text-txt-primary">Admin</h2>
            </div>
            <p className="text-xs text-txt-muted mb-5">
              Administrative access only
            </p>

            <div className="space-y-4">
              <div>
                <label htmlFor="admin-email" className="block text-xs font-medium text-txt-secondary mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  id="admin-email"
                  required
                  className="input-dark"
                  value={adminForm.email}
                  onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-xs font-medium text-txt-secondary mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  required
                  className="input-dark"
                  value={adminForm.password}
                  onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                />
              </div>
              <Button type="submit" loading={adminLoading} variant="secondary" className="w-full">
                Sign In
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

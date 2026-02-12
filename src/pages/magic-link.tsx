import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { useAuth } from '@/context/AuthContext'

export default function MagicLinkPage() {
  const router = useRouter()
  const { loginWithMagicLink } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(true)

  const token = useMemo(() => {
    const value = router.query.token
    return typeof value === 'string' ? value : ''
  }, [router.query.token])

  const nextPath = useMemo(() => {
    const value = router.query.next
    if (typeof value !== 'string') {
      return '/'
    }
    return value.startsWith('/') && !value.startsWith('//') ? value : '/'
  }, [router.query.next])

  useEffect(() => {
    if (!router.isReady) {
      return
    }

    if (!token) {
      setError('Magic link is missing or invalid.')
      setProcessing(false)
      return
    }

    const run = async () => {
      try {
        await loginWithMagicLink(token)
        router.replace(nextPath)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Magic link verification failed')
      } finally {
        setProcessing(false)
      }
    }

    run()
  }, [router, router.isReady, token, nextPath, loginWithMagicLink])

  return (
    <>
      <Head>
        <title>Magic Link Sign In - DaBus</title>
      </Head>
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="glass rounded-3xl p-10 w-full max-w-sm text-center animate-scale-in">
          {processing && (
            <>
              <div className="w-12 h-12 rounded-full border-2 border-[rgba(var(--accent),0.2)] border-t-accent animate-spin mx-auto mb-5" />
              <p className="font-display font-bold text-txt-primary text-lg mb-1">Signing you in</p>
              <p className="text-txt-muted text-sm">Verifying your magic link...</p>
            </>
          )}
          {!processing && error && (
            <>
              <div className="w-12 h-12 rounded-full bg-[rgba(var(--danger),0.1)] flex items-center justify-center mx-auto mb-5">
                <svg className="w-6 h-6 text-[rgb(var(--danger))]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-[rgb(var(--danger))] text-sm mb-4">{error}</p>
              <button
                onClick={() => router.push(`/login?next=${encodeURIComponent(nextPath)}`)}
                className="text-accent text-sm hover:underline"
              >
                Request a new magic link
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}

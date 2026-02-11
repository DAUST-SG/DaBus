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
        <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-md text-center">
          {processing && (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
              <p className="text-gray-700">Signing you in...</p>
            </>
          )}
          {!processing && error && (
            <>
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={() => router.push(`/login?next=${encodeURIComponent(nextPath)}`)}
                className="text-blue-600 hover:text-blue-700"
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

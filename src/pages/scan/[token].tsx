import { useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import BoardingScanner, { ScanSummary } from '@/components/BoardingScanner'

// The trip's passenger scanner: no account, the private link is the access
export default function PassengerScanPage() {
  const router = useRouter()
  const token = typeof router.query.token === 'string' ? router.query.token : ''
  const [summary, setSummary] = useState<ScanSummary | null>(null)

  return (
    <>
      <Head>
        <title>Check tickets - DaBus</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="max-w-lg mx-auto space-y-4 animate-fade-in">
        <div>
          <h1 className="font-display text-2xl font-bold text-txt-primary">Check tickets</h1>
          {summary && <p className="text-sm text-txt-secondary mt-1">{summary.trip.label}</p>}
          <p className="text-xs text-txt-muted mt-2">
            Scan each passenger&apos;s ticket QR code as they board. If their phone is off, type the ticket code
            or tap Board next to their name. This link is only for you.
          </p>
        </div>
        {token && <BoardingScanner endpoint={`/scan/${token}`} onSummary={setSummary} />}
      </div>
    </>
  )
}

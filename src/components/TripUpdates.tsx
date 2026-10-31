import { TripUpdate } from '@/types'

const postedAt = (ms: number) =>
  new Date(ms).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Dakar' })

// Notices from the DaBus team (delays, stop changes...). Renders nothing when there are none.
export default function TripUpdates({ updates, title = 'Updates from the DaBus team' }: { updates?: TripUpdate[]; title?: string }) {
  if (!updates?.length) return null
  return (
    <section className="glass rounded-2xl p-5 border-l-4 border-l-accent">
      <h2 className="text-xs font-semibold text-accent uppercase tracking-widest mb-3">{title}</h2>
      <ul className="space-y-3">
        {updates.map((u) => (
          <li key={u.id}>
            <p className="text-sm text-txt-primary whitespace-pre-line break-words">{u.message}</p>
            <p className="text-xs text-txt-muted mt-0.5">
              {postedAt(u.created_at)}{u.trip_id ? '' : ' · for everyone'}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}

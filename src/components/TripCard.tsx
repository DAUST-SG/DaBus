import Link from 'next/link'
import { Trip } from '@/types'

interface TripCardProps {
  trip: Trip
}

export default function TripCard({ trip }: TripCardProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }

  const fillPercent = ((trip.capacity - trip.available_seats) / trip.capacity) * 100
  const isFull = trip.status === 'full' || trip.available_seats === 0

  return (
    <Link href={`/trips/${trip.id}`} className="block group">
      <div className="bg-[rgb(var(--bg-card))] border-2 border-[rgba(255,255,255,0.05)] clip-edge p-6 transition-all duration-200 hover:-translate-y-1 hover:-translate-x-1 hover:border-[rgb(var(--accent))] hover:shadow-[6px_6px_0_rgba(var(--accent),0.3)]">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <span className="font-display tracking-wider text-lg text-white truncate">{trip.origin}</span>
              <div className="flex items-center gap-1 flex-shrink-0">
                <div className="w-2 h-2 bg-[rgb(var(--accent))] skew-box" />
                <div className="w-8 h-0.5 bg-[rgb(var(--accent))]" />
                <div className="w-2 h-2 bg-[rgb(var(--accent))] skew-box" />
              </div>
              <span className="font-display tracking-wider text-lg text-white truncate">{trip.destination}</span>
            </div>
            <p className="text-sm text-[rgb(var(--text-secondary))] font-display tracking-wider flex items-center gap-2">
              <svg className="w-4 h-4 text-[rgb(var(--accent))]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {formatDate(trip.departure_date).toUpperCase()} - {trip.departure_time}
            </p>
          </div>
          <span
            className={`badge flex-shrink-0 ml-3 ${
              trip.status === 'scheduled'
                ? 'badge-success'
                : trip.status === 'full'
                  ? 'badge-warning'
                  : 'badge-neutral'
            }`}
          >
            {trip.status === 'scheduled' ? 'OPEN' : trip.status === 'full' ? 'FULL' : trip.status.toUpperCase()}
          </span>
        </div>

        {/* Seats Progress */}
        <div className="mb-6">
          <div className="flex justify-between items-center text-sm font-display tracking-widest mb-2">
            <span className="text-[rgb(var(--text-muted))]">
              <span className="text-white">{trip.available_seats}</span> / {trip.capacity} SEATS
            </span>
            <span className="text-[rgb(var(--text-muted))]">{Math.round(fillPercent)}% FILLED</span>
          </div>
          <div className="w-full h-1 bg-[rgba(255,255,255,0.1)] skew-box relative overflow-hidden">
            <div
              className={`absolute top-0 left-0 h-full transition-all duration-500 ${
                fillPercent > 80
                  ? 'bg-[rgb(var(--warning))]'
                  : 'bg-[rgb(var(--accent))] glow-accent-sm'
              }`}
              style={{ width: `${fillPercent}%` }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-end pt-4 border-t-2 border-[rgba(255,255,255,0.05)] group-hover:border-[rgba(var(--accent),0.2)]">
          <div className="font-display flex flex-col">
            <span className="text-[rgb(var(--accent))] text-xs tracking-widest mb-1">PRICE</span>
            <span className="text-3xl text-white">
              {trip.price.toLocaleString()} <span className="text-sm text-[rgb(var(--text-muted))]">CFA</span>
            </span>
          </div>
          <span
            className={`font-display text-sm tracking-widest px-4 py-2 skew-box transition-all duration-200 ${
              isFull
                ? 'bg-transparent text-[rgb(var(--text-muted))] border-2 border-[rgba(255,255,255,0.1)]'
                : 'bg-[rgb(var(--accent))] text-black shadow-[2px_2px_0_white] group-hover:bg-white group-hover:shadow-[2px_2px_0_rgb(var(--accent))]'
            }`}
          >
            <div className="unskew-text">
               {isFull ? 'SOLD OUT' : 'BOOK SEAT'}
            </div>
          </span>
        </div>
      </div>
    </Link>
  )
}

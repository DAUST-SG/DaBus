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
      <div className="glass rounded-2xl p-5 transition-all duration-300 hover:bg-[rgba(var(--bg-card-hover),0.85)] hover:border-[rgba(var(--border-subtle),0.12)] hover:-translate-y-1 hover:shadow-card">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-txt-primary font-semibold truncate">{trip.origin}</span>
              <div className="flex items-center gap-1 flex-shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                <div className="w-8 h-px bg-gradient-to-r from-accent to-accent-hover" />
                <svg className="w-3 h-3 text-accent" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-txt-primary font-semibold truncate">{trip.destination}</span>
            </div>
            <p className="text-xs text-txt-muted flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {formatDate(trip.departure_date)} at {trip.departure_time}
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
            {trip.status === 'scheduled' ? 'Open' : trip.status === 'full' ? 'Full' : trip.status}
          </span>
        </div>

        {/* Seats Progress */}
        <div className="mb-4">
          <div className="flex justify-between items-center text-xs mb-2">
            <span className="text-txt-muted">
              <span className="text-txt-secondary font-medium">{trip.available_seats}</span> seats left
            </span>
            <span className="text-txt-muted">{trip.capacity} total</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                fillPercent > 80
                  ? 'bg-gradient-to-r from-[rgb(var(--danger))] to-[rgb(var(--warning))]'
                  : fillPercent > 50
                    ? 'bg-gradient-to-r from-[rgb(var(--warning))] to-accent'
                    : 'bg-gradient-to-r from-accent to-accent-hover'
              }`}
              style={{ width: `${fillPercent}%` }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-3 border-t border-subtle">
          <span className="font-display text-xl font-bold text-gradient">
            {trip.price.toLocaleString()} <span className="text-sm font-body font-normal text-txt-muted">CFA</span>
          </span>
          <span
            className={`text-sm font-medium transition-all duration-200 ${
              isFull
                ? 'text-txt-muted'
                : 'text-accent group-hover:translate-x-1 inline-flex items-center gap-1'
            }`}
          >
            {isFull ? 'Sold Out' : (
              <>
                Book
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </>
            )}
          </span>
        </div>
      </div>
    </Link>
  )
}

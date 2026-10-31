import { useState, useEffect } from 'react'
import Head from 'next/head'
import TripCard from '@/components/TripCard'
import api from '@/lib/api'
import TripUpdates from '@/components/TripUpdates'
import { Trip, TripUpdate } from '@/types'

export default function HomePage() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState({
    origin: '',
    destination: '',
  })

  const [updates, setUpdates] = useState<TripUpdate[]>([])

  useEffect(() => {
    fetchTrips()
    // News is optional: the page works without it
    api.get<{ success: boolean; data: TripUpdate[] }>('/updates').then((r) => setUpdates(r.data.data || [])).catch(() => {})
  }, [])

  const fetchTrips = async () => {
    try {
      setLoading(true)
      const response = await api.get<{ success: boolean; data: Trip[] }>('/trips')
      if (response.data.success) {
        setTrips(response.data.data || [])
      }
    } catch (err) {
      setError('Failed to load trips')
    } finally {
      setLoading(false)
    }
  }

  const filteredTrips = trips.filter((trip) => {
    const matchesOrigin = !filter.origin ||
      trip.origin.toLowerCase().includes(filter.origin.toLowerCase())
    const matchesDestination = !filter.destination ||
      trip.destination.toLowerCase().includes(filter.destination.toLowerCase())
    return matchesOrigin && matchesDestination
  })

  return (
    <>
      <Head>
        <title>DaBus - Student Transportation Booking</title>
        <meta name="description" content="Book your bus ride from campus to home" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="space-y-10">
        {/* Hero Section */}
        <section className="relative overflow-hidden rounded-3xl noise-overlay animate-fade-in">
          {/* Gradient backdrop */}
          <div className="absolute inset-0 bg-gradient-to-br from-[rgba(var(--accent),0.12)] via-surface-card to-surface-secondary" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-[rgba(var(--accent),0.08)] rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3" />

          <div className="relative px-6 sm:px-10 py-12 sm:py-16">
            <div className="max-w-2xl">
              <p className="text-accent text-sm font-medium tracking-widest uppercase mb-3 animate-slide-up" style={{ animationDelay: '0.1s', opacity: 0 }}>
                DAUST Student Shuttle
              </p>
              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold text-txt-primary leading-[1.1] mb-4 animate-slide-up" style={{ animationDelay: '0.2s', opacity: 0 }}>
                Your Journey<br />
                <span className="text-gradient">Starts Here</span>
              </h1>
              <p className="text-txt-secondary text-base sm:text-lg max-w-lg mb-8 animate-slide-up" style={{ animationDelay: '0.3s', opacity: 0 }}>
                Safe, reliable transportation from campus to your home region. Book your seat in seconds.
              </p>
            </div>

            {/* Search */}
            <div className="flex flex-col sm:flex-row gap-3 max-w-xl animate-slide-up" style={{ animationDelay: '0.4s', opacity: 0 }}>
              <div className="flex-1 relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="From where?"
                  className="input-dark pl-10"
                  value={filter.origin}
                  onChange={(e) => setFilter({ ...filter, origin: e.target.value })}
                />
              </div>
              <div className="flex-1 relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Going to?"
                  className="input-dark pl-10"
                  value={filter.destination}
                  onChange={(e) => setFilter({ ...filter, destination: e.target.value })}
                />
              </div>
            </div>
          </div>
        </section>

        <TripUpdates updates={updates} title="News from the DaBus team" />

        {/* Trips Section */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-2xl font-bold text-txt-primary">
              Available Trips
            </h2>
            {filteredTrips.length > 0 && (
              <span className="text-sm text-txt-muted">
                {filteredTrips.length} trip{filteredTrips.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-10 h-10 rounded-full border-2 border-[rgba(var(--accent),0.2)] border-t-accent animate-spin" />
              <p className="text-txt-muted text-sm mt-4">Loading trips...</p>
            </div>
          ) : error ? (
            <div className="text-center py-16 glass rounded-2xl">
              <p className="text-[rgb(var(--danger))] mb-3">{error}</p>
              <button
                onClick={fetchTrips}
                className="text-accent text-sm hover:underline"
              >
                Try again
              </button>
            </div>
          ) : filteredTrips.length === 0 ? (
            <div className="text-center py-16 glass rounded-2xl">
              <div className="w-16 h-16 rounded-2xl bg-[rgba(var(--accent),0.08)] flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-txt-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
              <p className="text-txt-secondary text-lg mb-1">No trips found</p>
              <p className="text-txt-muted text-sm">Check back later for new routes</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTrips.map((trip, i) => (
                <div key={trip.id} className="animate-slide-up" style={{ animationDelay: `${i * 0.08}s`, opacity: 0 }}>
                  <TripCard trip={trip} />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Features */}
        <section className="pb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                ),
                title: 'Safe & Verified',
                desc: 'All buses and drivers are verified for your safety',
              },
              {
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                ),
                title: 'Mobile Payments',
                desc: 'Pay instantly with Wave or Orange Money',
              },
              {
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                ),
                title: 'Campus Routes',
                desc: 'Direct routes from DAUST to major cities',
              },
            ].map((feature, i) => (
              <div
                key={feature.title}
                className="glass rounded-2xl p-6 group hover:bg-[rgba(var(--bg-card-hover),0.85)] transition-all duration-300 animate-slide-up"
                style={{ animationDelay: `${0.6 + i * 0.1}s`, opacity: 0 }}
              >
                <div className="w-10 h-10 rounded-xl bg-[rgba(var(--accent),0.1)] flex items-center justify-center mb-4 group-hover:bg-[rgba(var(--accent),0.15)] transition-colors">
                  <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    {feature.icon}
                  </svg>
                </div>
                <h3 className="font-semibold text-txt-primary mb-1">{feature.title}</h3>
                <p className="text-sm text-txt-muted leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}

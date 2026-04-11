import { useState, useEffect } from 'react'
import Head from 'next/head'
import TripCard from '@/components/TripCard'
import api from '@/lib/api'
import { Trip } from '@/types'

export default function HomePage() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState({
    origin: '',
    destination: '',
  })

  useEffect(() => {
    fetchTrips()
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
        <title>DaBus | Student Transportation</title>
        <meta name="description" content="Book your bus ride from campus to home" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="space-y-16 pb-16">
        {/* Extreme Hero Section */}
        <section className="relative overflow-hidden pt-20 pb-24 border-b-2 border-[rgba(255,255,255,0.1)] noise-overlay">
          {/* Neon accents in background */}
          <div className="absolute top-10 right-10 w-64 h-64 bg-[rgb(var(--accent))] rounded-full blur-[150px] opacity-20 pointer-events-none" />
          <div className="absolute bottom-0 left-20 w-80 h-32 bg-[rgb(var(--accent))] skew-box blur-[100px] opacity-10 pointer-events-none" />

          <div className="relative px-6 sm:px-10 max-w-7xl mx-auto flex flex-col lg:flex-row gap-12 items-center">
            {/* Typography Heavy Left */}
            <div className="flex-1 w-full z-10">
              <div className="mb-4 inline-block bg-[rgb(var(--accent))] text-black px-4 py-1 skew-box animate-slide-up" style={{ animationDelay: '0.1s', opacity: 0 }}>
                <span className="unskew-text font-display text-sm font-bold tracking-widest">DAUST SHUTTLE ZERO-ONE</span>
              </div>
              
              <h1 className="font-display flex flex-col gap-2 mb-8 animate-slide-up" style={{ animationDelay: '0.2s', opacity: 0 }}>
                <span className="text-5xl sm:text-7xl lg:text-8xl font-black text-white leading-none tracking-tighter shadow-black drop-shadow-xl">YOUR</span>
                <span className="text-5xl sm:text-7xl lg:text-8xl font-black text-white leading-none tracking-tighter">JOURNEY</span>
                <div className="relative inline-block w-fit">
                  <span className="text-5xl sm:text-7xl lg:text-8xl font-black text-stroke-accent leading-none tracking-tight">STARTS HERE</span>
                  {/* Glitch sublayer */}
                  <span className="absolute top-0 left-[2px] text-5xl sm:text-7xl lg:text-8xl font-black text-[rgb(var(--accent))] leading-none tracking-tight opacity-50 z-[-1] animate-glitch">STARTS HERE</span>
                </div>
              </h1>

              {/* Aggressive Search */}
              <div className="flex flex-col sm:flex-row gap-4 max-w-2xl bg-black border-2 border-[rgba(255,255,255,0.1)] p-4 clip-edge animate-slide-up" style={{ animationDelay: '0.3s', opacity: 0 }}>
                <div className="flex-1 relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 w-2 h-2 bg-[rgb(var(--accent))] skew-box group-focus-within:glow-accent" />
                  <input
                    type="text"
                    placeholder="ORIGIN"
                    className="w-full bg-transparent border-b-2 border-[rgba(255,255,255,0.1)] focus:border-[rgb(var(--accent))] text-white font-display text-lg tracking-widest py-3 pl-10 pr-4 outline-none transition-colors placeholder:text-[rgba(255,255,255,0.2)]"
                    value={filter.origin}
                    onChange={(e) => setFilter({ ...filter, origin: e.target.value })}
                  />
                </div>
                <div className="flex-1 relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 w-2 h-2 bg-[rgb(var(--accent))] skew-box group-focus-within:glow-accent" />
                  <input
                    type="text"
                    placeholder="DESTINATION"
                    className="w-full bg-transparent border-b-2 border-[rgba(255,255,255,0.1)] focus:border-[rgb(var(--accent))] text-white font-display text-lg tracking-widest py-3 pl-10 pr-4 outline-none transition-colors placeholder:text-[rgba(255,255,255,0.2)]"
                    value={filter.destination}
                    onChange={(e) => setFilter({ ...filter, destination: e.target.value })}
                  />
                </div>
              </div>
            </div>
            
            {/* Visual Right Side */}
            <div className="hidden lg:block w-[400px] h-[500px] border-l-4 border-b-4 border-[rgb(var(--accent))] p-4 relative animate-fade-in">
                <div className="w-full h-full bg-[rgba(255,255,255,0.02)] noise-overlay flex items-center justify-center p-8">
                  <div className="w-full h-full border border-[rgba(255,255,255,0.1)] relative">
                    <div className="absolute -top-1 -left-1 w-2 h-2 bg-[rgb(var(--accent))]" />
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-[rgb(var(--accent))]" />
                    <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-[rgb(var(--accent))]" />
                    <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-[rgb(var(--accent))]" />
                    
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                       <svg className="w-32 h-32 text-[rgba(255,255,255,0.2)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="square" strokeLinejoin="miter" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                  </div>
                </div>
            </div>
          </div>
        </section>

        {/* Trips Section */}
        <section className="px-6 sm:px-10 max-w-7xl mx-auto">
          <div className="flex items-end justify-between border-b-2 border-[rgba(255,255,255,0.1)] pb-4 mb-8">
            <h2 className="font-display text-3xl font-bold text-white tracking-widest flex items-center gap-4">
              <div className="w-4 h-4 bg-[rgb(var(--accent))] skew-box animate-pulse" />
              DEPLOYED ROUTES
            </h2>
            {filteredTrips.length > 0 && (
              <span className="font-display tracking-widest text-[rgb(var(--accent))]">
                [{filteredTrips.length}] FOUND
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 border border-[rgba(255,255,255,0.05)] clip-edge">
              <div className="w-12 h-12 skew-box border-4 border-black border-t-[rgb(var(--accent))] animate-spin" />
              <p className="font-display tracking-widest text-[rgb(var(--accent))] mt-6">ACQUIRING DATA...</p>
            </div>
          ) : error ? (
            <div className="text-center py-24 bg-[rgb(var(--bg-card))] clip-edge border-2 border-[rgb(var(--danger))]">
              <p className="font-display text-xl text-[rgb(var(--danger))] mb-4 tracking-widest">SYSTEM ERROR: {error.toUpperCase()}</p>
              <button
                onClick={fetchTrips}
                className="font-display text-black bg-[rgb(var(--danger))] px-6 py-2 skew-box hover:bg-white transition-colors"
              >
                <span className="unskew-text tracking-widest font-bold">RETRY SEQUENCE</span>
              </button>
            </div>
          ) : filteredTrips.length === 0 ? (
            <div className="text-center py-32 border-2 border-[rgba(255,255,255,0.05)] clip-edge">
              <div className="w-16 h-16 bg-[rgba(255,255,255,0.05)] skew-box flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-[rgba(255,255,255,0.5)] unskew-text" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="square" strokeLinejoin="miter" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
              <p className="font-display text-2xl text-white mb-2 tracking-widest">NO ROUTES ACTIVE</p>
              <p className="text-[rgb(var(--text-muted))] tracking-widest uppercase text-sm font-display">Update coordinates and try again</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTrips.map((trip, i) => (
                <div key={trip.id} className="animate-slide-up" style={{ animationDelay: `${i * 0.05}s`, opacity: 0 }}>
                  <TripCard trip={trip} />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Technical Features */}
        <section className="px-6 sm:px-10 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: (
                  <path strokeLinecap="square" strokeLinejoin="miter" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                ),
                title: 'VERIFIED TRANSIT',
                desc: 'All vehicles and operators pass strict security clearance.',
              },
              {
                icon: (
                  <path strokeLinecap="square" strokeLinejoin="miter" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                ),
                title: 'INSTANT CLEARANCE',
                desc: 'Lightning-fast mobile payments via digital wallets.',
              },
              {
                icon: (
                  <path strokeLinecap="square" strokeLinejoin="miter" d="M13 10V3L4 14h7v7l9-11h-7z" />
                ),
                title: 'DIRECT ROUTES',
                desc: 'Point-to-point transit from campus to major hubs.',
              },
            ].map((feature, i) => (
              <div
                key={feature.title}
                className="bg-[rgb(var(--bg-card))] border-2 border-[rgba(255,255,255,0.05)] p-8 clip-edge group hover:border-[rgb(var(--accent))] transition-colors duration-300 animate-slide-up"
                style={{ animationDelay: `${0.4 + i * 0.1}s`, opacity: 0 }}
              >
                <div className="w-14 h-14 bg-black border-2 border-[rgb(var(--accent))] skew-box flex items-center justify-center mb-6 shadow-[3px_3px_0_rgb(var(--accent))] group-hover:shadow-[5px_5px_0_white] group-hover:-translate-y-1 group-hover:-translate-x-1 transition-all">
                  <svg className="w-7 h-7 text-[rgb(var(--accent))] unskew-text" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    {feature.icon}
                  </svg>
                </div>
                <h3 className="font-display font-bold tracking-widest text-white mb-2">{feature.title}</h3>
                <p className="text-[rgb(var(--text-secondary))] leading-relaxed flex-1">{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}

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

  return (
    <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {trip.origin} → {trip.destination}
          </h3>
          <p className="text-gray-500">{formatDate(trip.departure_date)} at {trip.departure_time}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          trip.status === 'scheduled' ? 'bg-green-100 text-green-800' :
          trip.status === 'full' ? 'bg-yellow-100 text-yellow-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {trip.status === 'scheduled' ? 'Available' : trip.status.charAt(0).toUpperCase() + trip.status.slice(1)}
        </span>
      </div>
      
      <div className="flex justify-between items-center mb-4">
        <div className="text-gray-600">
          <span className="font-medium">{trip.available_seats}</span> / {trip.capacity} seats
        </div>
        <div className="text-2xl font-bold text-blue-600">
          {trip.price.toLocaleString()} CFA
        </div>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all"
          style={{ width: `${((trip.capacity - trip.available_seats) / trip.capacity) * 100}%` }}
        />
      </div>

      <Link
        href={`/trips/${trip.id}`}
        className="block w-full text-center bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition-colors"
      >
        {trip.status === 'full' ? 'Sold Out' : 'Book Now'}
      </Link>
    </div>
  )
}

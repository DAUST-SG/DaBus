import { useEffect, useState } from 'react'
import api from '@/lib/api'
import Button from '@/components/Button'
import { Trip, TripUpdate } from '@/types'
import { formatDakarTime, formatTripDate } from '@/lib/time'
import { apiError, formatDeparture } from './shared'

type AdminUpdate = TripUpdate & { trip_label: string | null; posted_by: string }

// Admin → Updates: post notices for one trip or for everyone, and delete them.
// tripId preselects a trip (the "Post update" button on a trip)
export default function UpdatesTab({ trips, tripId = '' }: { trips: Trip[]; tripId?: string }) {
  const [updates, setUpdates] = useState<AdminUpdate[]>([])
  const [updateForm, setUpdateForm] = useState({ trip_id: tripId, message: '' })
  const [postingUpdate, setPostingUpdate] = useState(false)

  const loadUpdates = async () => {
    try {
      const response = await api.get<{ success: boolean; data: AdminUpdate[] }>('/admin/updates')
      if (response.data.success) setUpdates(response.data.data || [])
    } catch (err) {
      alert(apiError(err, 'Failed to load updates'))
    }
  }

  const handlePostUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setPostingUpdate(true)
    try {
      await api.post('/admin/updates', updateForm)
      setUpdateForm({ ...updateForm, message: '' })
      await loadUpdates()
    } catch (err) {
      alert(apiError(err, 'Failed to post update'))
    } finally {
      setPostingUpdate(false)
    }
  }

  const handleDeleteUpdate = async (id: string) => {
    if (!confirm('Delete this update? Passengers will no longer see it.')) return
    try {
      await api.delete(`/admin/updates?id=${encodeURIComponent(id)}`)
      setUpdates(updates.filter((u) => u.id !== id))
    } catch (err) {
      alert(apiError(err, 'Failed to delete update'))
    }
  }

  useEffect(() => {
    loadUpdates()
  }, [])

  return (
          <div className="space-y-4">
            <form onSubmit={handlePostUpdate} className="glass rounded-2xl p-4 sm:p-6 space-y-4">
              <div>
                <h2 className="font-display font-bold text-txt-primary">Post an update</h2>
                <p className="text-xs text-txt-muted mt-1">
                  Shown on the trip page and on passengers&apos; tickets. Updates &quot;for everyone&quot; also show on the home page.
                </p>
              </div>
              <select
                className="input-dark"
                value={updateForm.trip_id}
                onChange={(e) => setUpdateForm({ ...updateForm, trip_id: e.target.value })}
              >
                <option value="">For everyone</option>
                {trips.map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    {trip.origin} → {trip.destination} · {formatDeparture(trip)}
                  </option>
                ))}
              </select>
              <textarea
                className="input-dark min-h-[100px]"
                maxLength={1000}
                placeholder="e.g. The bus is 20 minutes late. Pickup at the main gate instead of the library."
                value={updateForm.message}
                onChange={(e) => setUpdateForm({ ...updateForm, message: e.target.value })}
              />
              <div className="flex justify-end">
                <Button type="submit" size="sm" loading={postingUpdate} disabled={!updateForm.message.trim()}>
                  Post update
                </Button>
              </div>
            </form>

            <div className="glass rounded-2xl p-4 sm:p-6">
              <h2 className="font-display font-bold text-txt-primary mb-4">Posted updates</h2>
              {updates.length === 0 ? (
                <p className="text-sm text-txt-muted">No updates yet.</p>
              ) : (
                <ul className="divide-y divide-subtle">
                  {updates.map((u) => (
                    <li key={u.id} className="py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold text-accent uppercase tracking-widest">{u.trip_label || 'For everyone'}</p>
                        <p className="text-sm text-txt-primary whitespace-pre-line break-words mt-1">{u.message}</p>
                        <p className="text-xs text-txt-muted mt-1">
                          {formatTripDate(new Date(u.created_at).toISOString().slice(0, 10), { day: 'numeric', month: 'short' })} at {formatDakarTime(new Date(u.created_at).toISOString())} · {u.posted_by}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteUpdate(u.id)}>Delete</Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
  )
}

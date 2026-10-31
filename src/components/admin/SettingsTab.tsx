import { useEffect, useState } from 'react'
import api from '@/lib/api'
import Button from '@/components/Button'
import { Checkpoint } from '@/types'
import { apiError, BookingRules } from './shared'

// Admin → Settings: booking rules, plus the checkpoints, add-admin and password pop-ups
export default function SettingsTab() {
  const [bookingRules, setBookingRules] = useState<BookingRules | null>(null)
  const [savingRules, setSavingRules] = useState(false)
  const [rulesMessage, setRulesMessage] = useState<string | null>(null)

  const [showAddAdmin, setShowAddAdmin] = useState(false)
  const [newAdmin, setNewAdmin] = useState({ email: '', full_name: '', phone: '', password: '' })
  const [addingAdmin, setAddingAdmin] = useState(false)
  const [addAdminError, setAddAdminError] = useState<string | null>(null)
  const [addAdminSuccess, setAddAdminSuccess] = useState(false)

  const [showChangePassword, setShowChangePassword] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [changingPassword, setChangingPassword] = useState(false)
  const [changePasswordError, setChangePasswordError] = useState<string | null>(null)
  const [changePasswordSuccess, setChangePasswordSuccess] = useState(false)

  const [showCheckpoints, setShowCheckpoints] = useState(false)
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([])
  const [newCheckpoint, setNewCheckpoint] = useState({ name: '', city: '' })
  const [savingCheckpoint, setSavingCheckpoint] = useState(false)
  const [checkpointError, setCheckpointError] = useState<string | null>(null)

  useEffect(() => {
    api.get<{ success: boolean; data: BookingRules }>('/admin/settings')
      .then((response) => setBookingRules(response.data.data))
      .catch(() => setRulesMessage('Failed to load booking rules'))
  }, [])

  const handleSaveRules = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bookingRules) return
    setSavingRules(true)
    setRulesMessage(null)
    try {
      const response = await api.put<{ success: boolean; data: BookingRules }>('/admin/settings', bookingRules)
      if (response.data.success) {
        setBookingRules(response.data.data)
        setRulesMessage('Saved')
      }
    } catch (err: unknown) {
      setRulesMessage(apiError(err, 'Failed to save booking rules'))
    } finally {
      setSavingRules(false)
    }
  }

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddAdminError(null)
    setAddAdminSuccess(false)
    setAddingAdmin(true)
    try {
      const response = await api.post<{ success: boolean }>('/admin/members', newAdmin)
      if (response.data.success) {
        setAddAdminSuccess(true)
        setNewAdmin({ email: '', full_name: '', phone: '', password: '' })
        setTimeout(() => {
          setShowAddAdmin(false)
          setAddAdminSuccess(false)
        }, 1500)
      }
    } catch (err: unknown) {
      const errorMessage = typeof err === 'object' && err && 'response' in err &&
        (err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Failed to add admin'
      setAddAdminError(errorMessage)
    } finally {
      setAddingAdmin(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setChangePasswordError(null)
    setChangePasswordSuccess(false)

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setChangePasswordError('New passwords do not match')
      return
    }

    setChangingPassword(true)
    try {
      const response = await api.post<{ success: boolean }>('/admin/change-password', {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      })
      if (response.data.success) {
        setChangePasswordSuccess(true)
        setPasswordForm({ current_password: '', new_password: '', confirm_password: '' })
        setTimeout(() => {
          setShowChangePassword(false)
          setChangePasswordSuccess(false)
        }, 1500)
      }
    } catch (err: unknown) {
      const errorMessage = typeof err === 'object' && err && 'response' in err &&
        (err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Failed to change password'
      setChangePasswordError(errorMessage)
    } finally {
      setChangingPassword(false)
    }
  }

  const openCheckpoints = async () => {
    setShowCheckpoints(true)
    setCheckpointError(null)
    try {
      const response = await api.get<{ success: boolean; data: Checkpoint[] }>('/admin/checkpoints')
      if (response.data.success) setCheckpoints(response.data.data)
    } catch (err) {
      setCheckpointError(apiError(err, 'Failed to load checkpoints'))
    }
  }

  const handleAddCheckpoint = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingCheckpoint(true)
    setCheckpointError(null)
    try {
      const response = await api.post<{ success: boolean; data: Checkpoint }>('/admin/checkpoints', newCheckpoint)
      if (response.data.success) {
        setCheckpoints([...checkpoints, response.data.data])
        setNewCheckpoint({ name: '', city: newCheckpoint.city })
      }
    } catch (err) {
      setCheckpointError(apiError(err, 'Failed to add checkpoint'))
    } finally {
      setSavingCheckpoint(false)
    }
  }

  // Reorder (direction) or set the pickup time offset, then reload the list in its new order
  const handleCheckpointChange = async (checkpoint: Checkpoint, change: { direction: 'up' | 'down' } | { minutes_after_departure: string }) => {
    setCheckpointError(null)
    try {
      await api.patch('/admin/checkpoints', { id: checkpoint.id, ...change })
      const response = await api.get<{ success: boolean; data: Checkpoint[] }>('/admin/checkpoints')
      if (response.data.success) setCheckpoints(response.data.data)
    } catch (err) {
      setCheckpointError(apiError(err, 'Failed to update checkpoint'))
    }
  }

  const handleToggleCheckpoint = async (checkpoint: Checkpoint) => {
    setCheckpointError(null)
    try {
      const response = await api.patch<{ success: boolean; data: Checkpoint }>('/admin/checkpoints', {
        id: checkpoint.id,
        active: !checkpoint.active,
      })
      if (response.data.success) {
        setCheckpoints(checkpoints.map((c) => (c.id === checkpoint.id ? response.data.data : c)))
      }
    } catch (err) {
      setCheckpointError(apiError(err, 'Failed to update checkpoint'))
    }
  }

  return (
    <>
          <div className="space-y-4">
          <form onSubmit={handleSaveRules} className="glass rounded-2xl p-4 sm:p-6 space-y-4">
            <div>
              <h2 className="font-display font-bold text-txt-primary">Booking rules</h2>
              <p className="text-sm text-txt-muted">
                Limits stop people or scripts from holding seats with unpaid bookings. Paid bookings are never limited, and admins are not limited.
              </p>
            </div>
            {!bookingRules ? (
              <p className="text-sm text-txt-muted">{rulesMessage || 'Loading...'}</p>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {([
                    ['max_unpaid_per_phone', 'Unpaid bookings allowed at once, per phone number', '1'],
                    ['max_bookings_per_window', 'Bookings allowed per phone or device in the time window', '1'],
                    ['booking_window_minutes', 'Time window (minutes)', '1'],
                    ['refund_cutoff_hours', 'Students can cancel and get refunded until (hours before departure)', '0.5'],
                    ['default_booking_close_minutes', 'Bookings close (minutes before departure), for trips without their own setting', '5'],
                    ['auto_complete_hours', 'Mark trips completed automatically (hours after departure), if nobody does', '1'],
                    ['personal_data_months', 'Erase passengers\' name, phone and email (months after the trip). Amounts and trips are kept.', '1'],
                    ['payment_fee_percent', 'Naboopay fee paid by the passenger (%), shown with every price. Must match Naboopay\'s actual rate.', '0.1'],
                  ] as const).map(([key, label, step]) => (
                    <label key={key} className="block">
                      <span className="block text-xs font-medium text-txt-secondary mb-1.5">{label}</span>
                      <input
                        type="number"
                        required
                        min={key === 'refund_cutoff_hours' || key === 'default_booking_close_minutes' || key === 'payment_fee_percent' ? 0 : 1}
                        step={step}
                        className="input-dark"
                        value={bookingRules[key]}
                        onChange={(e) => setBookingRules({ ...bookingRules, [key]: Number(e.target.value) })}
                      />
                    </label>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <Button type="submit" size="sm" loading={savingRules}>Save rules</Button>
                  {rulesMessage && <span className="text-sm text-txt-muted">{rulesMessage}</span>}
                </div>
              </>
            )}
          </form>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { title: 'Checkpoints', text: 'Pickup and drop-off stops students choose from.', action: openCheckpoints },
              { title: 'Add admin', text: 'Give someone access to this dashboard.', action: () => { setShowAddAdmin(true); setAddAdminError(null); setAddAdminSuccess(false) } },
              { title: 'Password', text: 'Change your own password.', action: () => { setShowChangePassword(true); setChangePasswordError(null); setChangePasswordSuccess(false) } },
            ].map((item) => (
              <button
                key={item.title}
                type="button"
                onClick={item.action}
                className="glass rounded-2xl p-5 text-left hover:border-[rgba(var(--accent),0.4)] transition-colors"
              >
                <p className="font-display font-bold text-txt-primary mb-1">{item.title}</p>
                <p className="text-sm text-txt-muted">{item.text}</p>
              </button>
            ))}
          </div>
          </div>
        {/* Add Admin Modal */}
        {showAddAdmin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddAdmin(false)} />
            <div className="relative glass-strong rounded-3xl shadow-2xl max-w-md w-full p-7 animate-scale-in">
              <h2 className="font-display text-xl font-bold text-txt-primary mb-5">Add Admin Member</h2>

              {addAdminSuccess && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-[rgba(var(--success),0.1)] border border-[rgba(var(--success),0.2)] text-[rgb(var(--success))] text-sm">
                  Admin added successfully!
                </div>
              )}
              {addAdminError && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-[rgba(var(--danger),0.1)] border border-[rgba(var(--danger),0.2)] text-[rgb(var(--danger))] text-sm">
                  {addAdminError}
                </div>
              )}

              <form onSubmit={handleAddAdmin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-txt-secondary mb-1.5">Email</label>
                  <input
                    type="email"
                    required
                    className="input-dark"
                    placeholder="admin@example.com"
                    value={newAdmin.email}
                    onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-txt-secondary mb-1.5">Full Name</label>
                  <input
                    type="text"
                    required
                    className="input-dark"
                    placeholder="John Doe"
                    value={newAdmin.full_name}
                    onChange={(e) => setNewAdmin({ ...newAdmin, full_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-txt-secondary mb-1.5">Phone</label>
                  <input
                    type="tel"
                    required
                    className="input-dark"
                    placeholder="+221 77 000 0000"
                    value={newAdmin.phone}
                    onChange={(e) => setNewAdmin({ ...newAdmin, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-txt-secondary mb-1.5">Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    className="input-dark"
                    placeholder="Min 6 characters"
                    value={newAdmin.password}
                    onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                  />
                </div>
                <div className="flex gap-3 pt-3">
                  <Button type="button" variant="ghost" className="flex-1" onClick={() => setShowAddAdmin(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" loading={addingAdmin} className="flex-1">
                    Add Admin
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Checkpoints Modal */}
        {showCheckpoints && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCheckpoints(false)} />
            <div className="relative glass-strong rounded-3xl shadow-2xl max-w-md w-full p-7 animate-scale-in max-h-[90vh] overflow-y-auto">
              <h2 className="font-display text-xl font-bold text-txt-primary mb-1">Checkpoints</h2>
              <p className="text-xs text-txt-muted mb-5">
                Students pick from the active stops in the trip&apos;s origin city (pickup) and destination city (drop-off).
                Put each city&apos;s stops in route order with the arrows. &quot;Min&quot; is how many minutes after departure the
                bus reaches a pickup stop; students see the time (e.g. 07:30 + 20 min = 07:50). Leave it empty to show no time.
              </p>

              {checkpointError && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-[rgba(var(--danger),0.1)] border border-[rgba(var(--danger),0.2)] text-[rgb(var(--danger))] text-sm">
                  {checkpointError}
                </div>
              )}

              {checkpoints.length === 0 ? (
                <p className="text-txt-muted text-sm mb-5">No checkpoints yet</p>
              ) : (
                <ul className="divide-y divide-subtle mb-5">
                  {checkpoints.map((checkpoint, i) => {
                    const sameCity = (other?: Checkpoint) => other?.city === checkpoint.city
                    return (
                    <li key={checkpoint.id} className="flex items-center gap-2 py-2.5">
                      <div className="flex flex-col">
                        <button
                          type="button"
                          aria-label={`Move ${checkpoint.name} earlier`}
                          disabled={!sameCity(checkpoints[i - 1])}
                          onClick={() => handleCheckpointChange(checkpoint, { direction: 'up' })}
                          className="text-txt-muted hover:text-accent disabled:opacity-20 leading-none px-1"
                        >▲</button>
                        <button
                          type="button"
                          aria-label={`Move ${checkpoint.name} later`}
                          disabled={!sameCity(checkpoints[i + 1])}
                          onClick={() => handleCheckpointChange(checkpoint, { direction: 'down' })}
                          className="text-txt-muted hover:text-accent disabled:opacity-20 leading-none px-1"
                        >▼</button>
                      </div>
                      <div className={`flex-1 min-w-0 ${checkpoint.active ? '' : 'opacity-50'}`}>
                        <p className="text-sm font-medium text-txt-primary truncate">{checkpoint.name}</p>
                        <p className="text-xs text-txt-muted capitalize">{checkpoint.city}</p>
                      </div>
                      <label className="flex items-center gap-1 text-xs text-txt-muted">
                        +
                        <input
                          type="number"
                          min={0}
                          max={1440}
                          className="input-dark w-16 px-2 py-1 text-sm"
                          defaultValue={checkpoint.minutes_after_departure ?? ''}
                          onBlur={(e) => {
                            if (e.target.value !== String(checkpoint.minutes_after_departure ?? '')) {
                              handleCheckpointChange(checkpoint, { minutes_after_departure: e.target.value })
                            }
                          }}
                        />
                        min
                      </label>
                      <Button variant="ghost" size="sm" onClick={() => handleToggleCheckpoint(checkpoint)}>
                        {checkpoint.active ? 'Turn off' : 'Turn on'}
                      </Button>
                    </li>
                    )
                  })}
                </ul>
              )}

              <form onSubmit={handleAddCheckpoint} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-txt-secondary mb-1.5">Name</label>
                    <input
                      type="text"
                      required
                      className="input-dark"
                      placeholder="Liberté 6"
                      value={newCheckpoint.name}
                      onChange={(e) => setNewCheckpoint({ ...newCheckpoint, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-txt-secondary mb-1.5">City</label>
                    <input
                      type="text"
                      required
                      className="input-dark"
                      placeholder="Dakar"
                      value={newCheckpoint.city}
                      onChange={(e) => setNewCheckpoint({ ...newCheckpoint, city: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-1">
                  <Button type="button" variant="ghost" className="flex-1" onClick={() => setShowCheckpoints(false)}>
                    Close
                  </Button>
                  <Button type="submit" loading={savingCheckpoint} className="flex-1">
                    Add Checkpoint
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Change Password Modal */}
        {showChangePassword && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowChangePassword(false)} />
            <div className="relative glass-strong rounded-3xl shadow-2xl max-w-md w-full p-7 animate-scale-in">
              <h2 className="font-display text-xl font-bold text-txt-primary mb-5">Change Password</h2>

              {changePasswordSuccess && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-[rgba(var(--success),0.1)] border border-[rgba(var(--success),0.2)] text-[rgb(var(--success))] text-sm">
                  Password changed successfully!
                </div>
              )}
              {changePasswordError && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-[rgba(var(--danger),0.1)] border border-[rgba(var(--danger),0.2)] text-[rgb(var(--danger))] text-sm">
                  {changePasswordError}
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-txt-secondary mb-1.5">Current Password</label>
                  <input
                    type="password"
                    required
                    className="input-dark"
                    value={passwordForm.current_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-txt-secondary mb-1.5">New Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    className="input-dark"
                    placeholder="Min 6 characters"
                    value={passwordForm.new_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-txt-secondary mb-1.5">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    className="input-dark"
                    value={passwordForm.confirm_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                  />
                </div>
                <div className="flex gap-3 pt-3">
                  <Button type="button" variant="ghost" className="flex-1" onClick={() => setShowChangePassword(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" loading={changingPassword} className="flex-1">
                    Update Password
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
    </>
  )
}

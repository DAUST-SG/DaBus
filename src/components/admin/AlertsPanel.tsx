import { useEffect, useState } from 'react'
import api from '@/lib/api'
import Button from '@/components/Button'
import { apiError } from './shared'

type Problem = { id: string; kind: string; label: string; message: string; alerted: boolean; created_at: string }

// Admin → Settings: who gets failure emails, and the last 30 days of failures (convex/problems.ts)
export default function AlertsPanel() {
  const [emails, setEmails] = useState('')
  const [problems, setProblems] = useState<Problem[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    api.get<{ success: boolean; data: { alert_emails: string; problems: Problem[] } }>('/admin/problems')
      .then((response) => {
        setEmails(response.data.data.alert_emails)
        setProblems(response.data.data.problems)
      })
      .catch((err) => setMessage(apiError(err, 'Failed to load alerts')))
  }, [])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      const response = await api.put<{ success: boolean; data: { alert_emails: string } }>('/admin/problems', { alert_emails: emails })
      setEmails(response.data.data.alert_emails)
      setMessage('Saved')
    } catch (err) {
      setMessage(apiError(err, 'Failed to save'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="glass rounded-2xl p-4 sm:p-6 space-y-4">
      <div>
        <h2 className="font-display font-bold text-txt-primary">Alerts</h2>
        <p className="text-sm text-txt-muted">
          When a payment, refund, DaLedger report or email fails, it&apos;s listed here and emailed, at most once an hour per kind of problem.
        </p>
      </div>
      <label className="block">
        <span className="block text-xs font-medium text-txt-secondary mb-1.5">Send alerts to (comma-separated). Leave empty to alert every admin.</span>
        <input
          type="text"
          className="input-dark"
          placeholder="Every admin"
          value={emails}
          onChange={(e) => setEmails(e.target.value)}
        />
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" loading={saving}>Save</Button>
        {message && <span className="text-sm text-txt-muted">{message}</span>}
      </div>
      <div>
        <p className="text-[10px] font-semibold text-txt-muted uppercase tracking-widest mb-2">Recent problems</p>
        {!problems ? (
          <p className="text-sm text-txt-muted">Loading...</p>
        ) : problems.length === 0 ? (
          <p className="text-sm text-txt-muted">None in the last 30 days.</p>
        ) : (
          <ul className="space-y-2 max-h-80 overflow-y-auto">
            {problems.map((p) => (
              <li key={p.id} className="rounded-xl border border-[rgba(var(--danger),0.2)] bg-[rgba(var(--danger),0.05)] px-3 py-2">
                <div className="flex flex-wrap justify-between gap-2 text-xs">
                  <span className="font-medium text-txt-primary">{p.label}</span>
                  <span className="text-txt-muted">
                    {new Date(p.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Dakar' })}
                    {p.alerted ? ' · emailed' : ''}
                  </span>
                </div>
                <p className="text-xs text-txt-secondary mt-1 break-words">{p.message}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </form>
  )
}

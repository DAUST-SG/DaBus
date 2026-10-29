import { useState, useRef, useEffect } from 'react'

interface TimePickerProps {
  value: string // HH:MM
  onChange: (value: string) => void
}

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6) // 6:00 to 22:00
const MINUTES = ['00', '15', '30', '45']

export default function TimePicker({ value, onChange }: TimePickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selectedHour = value ? parseInt(value.split(':')[0]) : null
  const selectedMinute = value ? value.split(':')[1] : null

  // Default to hour selection, switch to minute after hour is picked
  const [step, setStep] = useState<'hour' | 'minute'>(value ? 'minute' : 'hour')
  const [pendingHour, setPendingHour] = useState<number | null>(selectedHour)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setStep(value ? 'minute' : 'hour')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [value])

  const openPicker = () => {
    setOpen(true)
    setPendingHour(selectedHour)
    setStep(value ? 'minute' : 'hour')
  }

  const selectHour = (h: number) => {
    setPendingHour(h)
    setStep('minute')
  }

  const selectMinute = (m: string) => {
    const h = pendingHour ?? 6
    const timeStr = `${String(h).padStart(2, '0')}:${m}`
    onChange(timeStr)
    setOpen(false)
  }

  const selectQuickTime = (timeStr: string) => {
    onChange(timeStr)
    setOpen(false)
  }

  const formatDisplay = () => {
    if (!value) return ''
    const [h, m] = value.split(':')
    const hour = parseInt(h)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}:${m} ${ampm}`
  }

  const QUICK_TIMES = [
    { label: 'Morning', times: ['06:00', '07:00', '08:00', '09:00'] },
    { label: 'Midday', times: ['10:00', '11:00', '12:00', '13:00'] },
    { label: 'Afternoon', times: ['14:00', '15:00', '16:00', '17:00'] },
    { label: 'Evening', times: ['18:00', '19:00', '20:00', '21:00'] },
  ]

  const formatTime = (t: string) => {
    const [h, m] = t.split(':')
    const hour = parseInt(h)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}:${m} ${ampm}`
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={openPicker}
        className="input-dark w-full text-left flex items-center gap-3 cursor-pointer"
      >
        <svg className="w-4 h-4 text-[rgb(var(--accent))] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className={value ? 'text-[rgb(var(--text-primary))]' : 'text-[rgb(var(--text-muted))]'}>
          {value ? formatDisplay() : 'Select time'}
        </span>
      </button>

      {open && (
        <div className="absolute z-[60] top-full left-0 mt-2 w-[280px] glass-strong rounded-2xl p-4 shadow-2xl shadow-black/40 animate-scale-in">
          {/* Quick time slots */}
          <div className="space-y-3 mb-4">
            {QUICK_TIMES.map((group) => (
              <div key={group.label}>
                <p className="text-[10px] font-semibold text-[rgb(var(--text-muted))] uppercase tracking-wider mb-1.5">
                  {group.label}
                </p>
                <div className="grid grid-cols-4 gap-1.5">
                  {group.times.map((t) => {
                    const isActive = value === t
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => selectQuickTime(t)}
                        className={`
                          py-2 rounded-lg text-xs font-medium transition-all duration-150
                          ${isActive
                            ? 'bg-[rgb(var(--accent))] text-[rgb(var(--bg-primary))] font-bold shadow-lg shadow-[rgba(var(--accent),0.3)]'
                            : 'text-[rgb(var(--text-secondary))] bg-[rgba(var(--overlay),0.04)] hover:bg-[rgba(var(--overlay),0.08)] hover:text-[rgb(var(--text-primary))]'
                          }
                        `}
                      >
                        {formatTime(t)}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Precise time picker */}
          <div className="border-t border-[rgba(var(--overlay),0.06)] pt-3">
            <p className="text-[10px] font-semibold text-[rgb(var(--text-muted))] uppercase tracking-wider mb-2">
              {step === 'hour' ? 'Select hour' : `${String(pendingHour).padStart(2, '0')}:__ \u2014 Select minutes`}
            </p>

            {step === 'hour' ? (
              <div className="grid grid-cols-6 gap-1">
                {HOURS.map((h) => {
                  const isActive = selectedHour === h
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => selectHour(h)}
                      className={`
                        py-1.5 rounded-lg text-xs font-medium transition-all duration-150
                        ${isActive
                          ? 'bg-[rgba(var(--accent),0.2)] text-[rgb(var(--accent))] font-bold'
                          : 'text-[rgb(var(--text-secondary))] hover:bg-[rgba(var(--overlay),0.06)] hover:text-[rgb(var(--text-primary))]'
                        }
                      `}
                    >
                      {String(h).padStart(2, '0')}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-1.5">
                {MINUTES.map((m) => {
                  const isActive = selectedMinute === m && selectedHour === pendingHour
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => selectMinute(m)}
                      className={`
                        py-2 rounded-lg text-sm font-medium transition-all duration-150
                        ${isActive
                          ? 'bg-[rgb(var(--accent))] text-[rgb(var(--bg-primary))] font-bold shadow-lg shadow-[rgba(var(--accent),0.3)]'
                          : 'text-[rgb(var(--text-secondary))] bg-[rgba(var(--overlay),0.04)] hover:bg-[rgba(var(--overlay),0.08)] hover:text-[rgb(var(--text-primary))]'
                        }
                      `}
                    >
                      :{m}
                    </button>
                  )
                })}
              </div>
            )}

            {step === 'minute' && (
              <button
                type="button"
                onClick={() => setStep('hour')}
                className="mt-2 text-xs text-[rgb(var(--text-muted))] hover:text-[rgb(var(--accent))] transition-colors"
              >
                &larr; Change hour
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

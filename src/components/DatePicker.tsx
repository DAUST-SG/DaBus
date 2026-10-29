import { useState, useRef, useEffect } from 'react'

interface DatePickerProps {
  value: string // YYYY-MM-DD
  onChange: (value: string) => void
  minDate?: string
}

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function DatePicker({ value, onChange, minDate }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const selected = value ? new Date(value + 'T00:00:00') : null
  const initialMonth = selected || today
  const [viewYear, setViewYear] = useState(initialMonth.getFullYear())
  const [viewMonth, setViewMonth] = useState(initialMonth.getMonth())

  const minDateObj = minDate ? new Date(minDate + 'T00:00:00') : today

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // When value changes externally, sync the view
  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T00:00:00')
      setViewYear(d.getFullYear())
      setViewMonth(d.getMonth())
    }
  }, [value])

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  // getDay() returns 0=Sun, we want 0=Mon
  const firstDayOfWeek = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear(viewYear - 1)
    } else {
      setViewMonth(viewMonth - 1)
    }
  }

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear(viewYear + 1)
    } else {
      setViewMonth(viewMonth + 1)
    }
  }

  const selectDay = (day: number) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    onChange(dateStr)
    setOpen(false)
  }

  const isDisabled = (day: number) => {
    const d = new Date(viewYear, viewMonth, day)
    return d < minDateObj
  }

  const isToday = (day: number) => {
    return viewYear === today.getFullYear() && viewMonth === today.getMonth() && day === today.getDate()
  }

  const isSelected = (day: number) => {
    if (!selected) return false
    return viewYear === selected.getFullYear() && viewMonth === selected.getMonth() && day === selected.getDate()
  }

  const formatDisplay = () => {
    if (!value) return ''
    const d = new Date(value + 'T00:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  }

  // Build calendar grid cells
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="input-dark w-full text-left flex items-center gap-3 cursor-pointer"
      >
        <svg className="w-4 h-4 text-[rgb(var(--accent))] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className={value ? 'text-[rgb(var(--text-primary))]' : 'text-[rgb(var(--text-muted))]'}>
          {value ? formatDisplay() : 'Select date'}
        </span>
      </button>

      {open && (
        <div className="absolute z-[60] top-full left-0 mt-2 w-[300px] glass-strong rounded-2xl p-4 shadow-2xl shadow-black/40 animate-scale-in">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={prevMonth}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))] hover:bg-[rgba(var(--overlay),0.06)] transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="font-display font-bold text-sm text-[rgb(var(--text-primary))]">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))] hover:bg-[rgba(var(--overlay),0.06)] transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-[10px] font-semibold text-[rgb(var(--text-muted))] uppercase tracking-wider py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, i) => {
              if (day === null) {
                return <div key={`empty-${i}`} className="w-full aspect-square" />
              }

              const disabled = isDisabled(day)
              const sel = isSelected(day)
              const tod = isToday(day)

              return (
                <button
                  key={day}
                  type="button"
                  disabled={disabled}
                  onClick={() => selectDay(day)}
                  className={`
                    w-full aspect-square rounded-lg text-sm font-medium transition-all duration-150
                    flex items-center justify-center relative
                    ${disabled
                      ? 'text-[rgb(var(--text-muted))] opacity-30 cursor-not-allowed'
                      : sel
                        ? 'bg-[rgb(var(--accent))] text-[rgb(var(--bg-primary))] font-bold shadow-lg shadow-[rgba(var(--accent),0.3)]'
                        : tod
                          ? 'text-[rgb(var(--accent))] bg-[rgba(var(--accent),0.1)] hover:bg-[rgba(var(--accent),0.2)]'
                          : 'text-[rgb(var(--text-primary))] hover:bg-[rgba(var(--overlay),0.08)]'
                    }
                  `}
                >
                  {day}
                  {tod && !sel && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[rgb(var(--accent))]" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Quick actions */}
          <div className="flex gap-2 mt-3 pt-3 border-t border-[rgba(var(--overlay),0.06)]">
            <button
              type="button"
              onClick={() => {
                const t = new Date()
                onChange(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`)
                setOpen(false)
              }}
              className="flex-1 text-xs py-1.5 rounded-lg text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--accent))] hover:bg-[rgba(var(--accent),0.08)] transition-all"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => {
                const t = new Date()
                t.setDate(t.getDate() + 1)
                onChange(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`)
                setOpen(false)
              }}
              className="flex-1 text-xs py-1.5 rounded-lg text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--accent))] hover:bg-[rgba(var(--accent),0.08)] transition-all"
            >
              Tomorrow
            </button>
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange('')
                  setOpen(false)
                }}
                className="flex-1 text-xs py-1.5 rounded-lg text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--danger))] hover:bg-[rgba(var(--danger),0.08)] transition-all"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

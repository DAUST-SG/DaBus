import { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
  loading?: boolean
}

export default function Button({
  variant = 'primary',
  size = 'md',
  children,
  loading = false,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles =
    'relative font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface-primary inline-flex items-center justify-center gap-2'

  const variants = {
    primary:
      'bg-gradient-to-r from-accent to-accent-hover text-surface-primary hover:shadow-glow focus:ring-accent active:scale-[0.98]',
    secondary:
      'bg-[rgba(255,255,255,0.06)] text-txt-primary border border-subtle hover:bg-[rgba(255,255,255,0.1)] hover:border-medium focus:ring-[rgba(255,255,255,0.2)]',
    danger:
      'bg-[rgba(239,68,68,0.12)] text-[rgb(var(--danger))] border border-[rgba(239,68,68,0.2)] hover:bg-[rgba(239,68,68,0.2)] focus:ring-[rgb(var(--danger))]',
    outline:
      'border border-[rgba(var(--accent),0.3)] text-accent hover:bg-[rgba(var(--accent),0.08)] hover:border-[rgba(var(--accent),0.5)] focus:ring-accent',
    ghost:
      'text-txt-secondary hover:text-txt-primary hover:bg-[rgba(255,255,255,0.06)] focus:ring-[rgba(255,255,255,0.1)]',
  }

  const sizes = {
    sm: 'px-3.5 py-2 text-sm',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-7 py-3.5 text-base',
  }

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${
        disabled || loading ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''
      } ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>Loading...</span>
        </>
      ) : (
        children
      )}
    </button>
  )
}

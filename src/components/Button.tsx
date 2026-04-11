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
    'relative font-display font-bold text-sm tracking-widest rounded-none transition-transform duration-100 focus:outline-none inline-flex items-center justify-center skew-box overflow-hidden group active:scale-[0.98]'

  const variants = {
    primary:
      'bg-[rgb(var(--accent))] text-black border-2 border-[rgb(var(--accent))] hover:bg-black hover:text-[rgb(var(--accent))] shadow-[4px_4px_0_rgba(var(--text-primary),0.2)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none',
    secondary:
      'bg-black text-[rgb(var(--text-primary))] border-2 border-[rgba(255,255,255,0.2)] hover:border-white hover:text-white',
    danger:
      'bg-transparent text-[rgb(var(--danger))] border-2 border-[rgb(var(--danger))] hover:bg-[rgb(var(--danger))] hover:text-black',
    outline:
      'bg-transparent border-2 border-[rgb(var(--accent))] text-[rgb(var(--accent))] hover:bg-[rgb(var(--accent))] hover:text-black',
    ghost:
      'text-[rgb(var(--text-secondary))] hover:text-white border-2 border-transparent hover:border-[rgba(255,255,255,0.1)]',
  }

  const sizes = {
    sm: 'px-6 py-2 pb-1.5',
    md: 'px-8 py-3 pb-2.5',
    lg: 'px-10 py-4 pb-3',
  }

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${
        disabled || loading ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
      } ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      <div className="unskew-text flex items-center justify-center gap-2">
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
            <span>LOADING</span>
          </>
        ) : (
          children
        )}
      </div>
    </button>
  )
}

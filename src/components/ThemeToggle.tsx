import { useEffect, useState } from 'react'

// Dark is the default; choosing light is remembered in this browser only
export default function ThemeToggle() {
  const [light, setLight] = useState(false)

  useEffect(() => {
    setLight(document.documentElement.dataset.theme === 'light')
  }, [])

  const toggle = () => {
    const next = !light
    setLight(next)
    if (next) {
      document.documentElement.dataset.theme = 'light'
    } else {
      delete document.documentElement.dataset.theme
    }
    try {
      localStorage.setItem('theme', next ? 'light' : 'dark')
    } catch {
      // Private mode or blocked storage: the choice just won't be remembered
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={light ? 'Switch to dark theme' : 'Switch to light theme'}
      title={light ? 'Dark theme' : 'Light theme'}
      className="p-2 rounded-lg text-txt-secondary hover:text-txt-primary hover:bg-[rgba(var(--overlay),0.06)] transition-colors"
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        {light ? (
          // Moon: go back to dark
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        ) : (
          // Sun: switch to light
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        )}
      </svg>
    </button>
  )
}

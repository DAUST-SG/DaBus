import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import api from '@/lib/api'
import { User, LoginRequest, ApiResponse } from '@/types'

interface AuthContextType {
  user: User | null
  loading: boolean
  error: string | null
  login: (data: LoginRequest) => Promise<void>
  requestStudentMagicLink: (email: string, nextPath?: string) => Promise<{ delivered: boolean; dev_magic_link?: string }>
  loginWithMagicLink: (token: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    const savedUser = localStorage.getItem('user')
    if (token && savedUser) {
      setUser(JSON.parse(savedUser))
      refreshUser()
    }
    setLoading(false)
  }, [])

  const saveSession = (token: string, nextUser: User) => {
    localStorage.setItem('auth_token', token)
    localStorage.setItem('user', JSON.stringify(nextUser))
    setUser(nextUser)
  }

  const extractApiError = (err: unknown, fallback: string) => {
    if (typeof err === 'object' && err && 'response' in err) {
      const apiError = (err as { response?: { data?: { error?: string } } }).response?.data?.error
      if (apiError) {
        return apiError
      }
    }
    if (err instanceof Error && err.message) {
      return err.message
    }
    return fallback
  }

  const refreshUser = async () => {
    try {
      const response = await api.get<ApiResponse<User>>('/auth/me')
      if (response.data.success && response.data.data) {
        setUser(response.data.data)
        localStorage.setItem('user', JSON.stringify(response.data.data))
      }
    } catch {
      logout()
    }
  }

  const login = async (data: LoginRequest) => {
    try {
      setError(null)
      const response = await api.post<ApiResponse<{ token: string; user: User }>>('/auth/login', data)
      if (response.data.success && response.data.data) {
        const { token, user } = response.data.data
        saveSession(token, user)
      }
    } catch (err: unknown) {
      const message = extractApiError(err, 'Login failed')
      setError(message)
      throw new Error(message)
    }
  }

  const requestStudentMagicLink = async (email: string, nextPath?: string) => {
    try {
      setError(null)
      const response = await api.post<ApiResponse<{ delivered: boolean; dev_magic_link?: string }>>('/auth/magic-link/request', {
        email,
        next: nextPath,
      })
      if (response.data.success && response.data.data) {
        return response.data.data
      }
      return { delivered: false }
    } catch (err: unknown) {
      const message = extractApiError(err, 'Failed to request magic link')
      setError(message)
      throw new Error(message)
    }
  }

  const loginWithMagicLink = async (token: string) => {
    try {
      setError(null)
      const response = await api.post<ApiResponse<{ token: string; user: User }>>('/auth/magic-link/verify', { token })
      if (response.data.success && response.data.data) {
        const { token: sessionToken, user: nextUser } = response.data.data
        saveSession(sessionToken, nextUser)
      }
    } catch (err: unknown) {
      const message = extractApiError(err, 'Magic link login failed')
      setError(message)
      throw new Error(message)
    }
  }

  const logout = () => {
    api.post('/auth/logout').catch(() => undefined)
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, error, login, requestStudentMagicLink, loginWithMagicLink, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

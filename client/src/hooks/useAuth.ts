import { useSyncExternalStore } from 'react'
import type { User } from '../types'

const TOKEN_KEY = 'unibot_token'
const USER_KEY  = 'unibot_user'

interface AuthState { token: string | null; user: User | null }

const listeners = new Set<() => void>()

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}

// Token expiry from the JWT payload (seconds since epoch)
function isExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()
  } catch {
    return true
  }
}

function read(): AuthState {
  const token = safeGet(TOKEN_KEY)
  const raw   = safeGet(USER_KEY)
  if (!token || !raw || isExpired(token)) return { token: null, user: null }
  try {
    return { token, user: JSON.parse(raw) as User }
  } catch {
    return { token: null, user: null }
  }
}

let state: AuthState = read()

function emit() {
  state = read()
  listeners.forEach(l => l())
}

export function setAuth(token: string, user: User) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  } catch { /* storage unavailable — session lasts until reload */ }
  emit()
}

export function clearAuth() {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  } catch { /* ignore */ }
  emit()
}

export function getToken(): string | null {
  return state.token
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  // Keep tabs in sync when signing in/out elsewhere
  const onStorage = (e: StorageEvent) => { if (e.key === TOKEN_KEY || e.key === USER_KEY) emit() }
  window.addEventListener('storage', onStorage)
  return () => { listeners.delete(listener); window.removeEventListener('storage', onStorage) }
}

export function useAuth() {
  const { user } = useSyncExternalStore(subscribe, () => state)
  return {
    user,
    isLoggedIn: !!user,
    isAdmin:    user?.role === 'admin',
    isStaff:    user?.role === 'staff',
    isStudent:  user?.role === 'student',
    login:      setAuth,
    logout:     clearAuth,
  }
}

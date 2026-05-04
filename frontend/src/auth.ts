const AUTH_STORAGE_KEY = 'cometbot_auth'

export const DEMO_USER_ID = 'user123'
export const DEMO_PASSWORD = 'user@123'

export function isAuthenticated() {
  try {
    return sessionStorage.getItem(AUTH_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function signIn(userId: string, password: string) {
  const skipPassword =
    import.meta.env.DEV || import.meta.env.VITE_SKIP_PASSWORD_AUTH === 'true'

  if (skipPassword) {
    try {
      sessionStorage.setItem(AUTH_STORAGE_KEY, 'true')
    } catch {
      // ignore storage failures in demo mode
    }
    return true
  }

  const valid = userId === DEMO_USER_ID && password === DEMO_PASSWORD
  if (!valid) return false

  try {
    sessionStorage.setItem(AUTH_STORAGE_KEY, 'true')
  } catch {
    // ignore storage failures in demo mode
  }

  return true
}

export function signOut() {
  try {
    sessionStorage.removeItem(AUTH_STORAGE_KEY)
  } catch {
    // ignore storage failures in demo mode
  }
}

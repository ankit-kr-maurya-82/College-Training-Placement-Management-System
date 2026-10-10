import { useEffect, useMemo, useState } from 'react'
import { api } from '../services/api.js'
import { AuthContext } from './auth.js'

function readClaims(token) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const claims = JSON.parse(atob(payload))
    if (claims.exp && claims.exp * 1000 <= Date.now()) return null
    return claims
  } catch { return null }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => sessionStorage.getItem('placement-token'))
  const [user, setUser] = useState(() => {
    const saved = sessionStorage.getItem('placement-user')
    const currentToken = sessionStorage.getItem('placement-token')
    if (!currentToken || !readClaims(currentToken)) return null
    try { return saved ? JSON.parse(saved) : readClaims(currentToken) } catch { return readClaims(currentToken) }
  })

  function saveSession(response) {
    if (!response?.token) throw new Error('The server did not return an authentication token.')
    const claims = readClaims(response.token)
    if (!claims) throw new Error('The server returned an invalid or expired session.')
    const profile = response.student || response.user || { ...claims, role: claims.role }
    sessionStorage.setItem('placement-token', response.token)
    sessionStorage.setItem('placement-user', JSON.stringify(profile))
    setToken(response.token)
    setUser(profile)
  }

  async function login(credentials) { saveSession(await api.post('/students/login', credentials)) }
  async function register(details) { saveSession(await api.post('/students/register', details)) }
  function logout() {
    sessionStorage.removeItem('placement-token')
    sessionStorage.removeItem('placement-user')
    setToken(null); setUser(null)
  }

  useEffect(() => {
    const reset = () => { sessionStorage.removeItem('placement-user'); setToken(null); setUser(null) }
    window.addEventListener('placement:unauthorized', reset)
    return () => window.removeEventListener('placement:unauthorized', reset)
  }, [])

  const value = useMemo(() => ({ token, user, login, register, logout, isManager: ['ADMIN', 'TPO'].includes(String(user?.role || '').toUpperCase()) }), [token, user])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}


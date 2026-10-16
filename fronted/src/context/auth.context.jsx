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
    const claims = currentToken ? readClaims(currentToken) : null
    if (!claims) return null
    try {
      const profile = saved ? JSON.parse(saved) : claims
      if (!profile.role && claims.studentId) profile.role = 'STUDENT'
      if (!profile.role && claims.role) profile.role = claims.role
      return profile
    } catch { return claims }
  })

  function saveSession(response) {
    if (!response?.token) throw new Error('The server did not return an authentication token.')
    const claims = readClaims(response.token)
    if (!claims) throw new Error('The server returned an invalid or expired session.')
    const profile = response.student ? { ...response.student, role: claims.role || 'STUDENT' } : response.user || (response.company ? {
      ...response.company,
      name: response.company.companyName || response.company.name,
      email: response.company.hrEmail || claims.email,
      role: 'COMPANY',
    } : { ...claims, role: claims.role })
    sessionStorage.setItem('placement-token', response.token)
    sessionStorage.setItem('placement-user', JSON.stringify(profile))
    setToken(response.token)
    setUser(profile)
  }

  async function login(credentials, accountType = 'STUDENT') {
    const endpoints = { STUDENT: '/students/login', COMPANY: '/companies/login', MANAGER: '/auth/manager/login' }
    const endpoint = endpoints[accountType]
    if (!endpoint) throw new Error('Choose a valid account type.')
    saveSession(await api.post(endpoint, credentials))
  }
  async function loginWithGoogle(credential) {
    if (typeof credential !== 'string' || !credential) throw new Error('A Google credential is required.')
    saveSession(await api.post('/auth/google', { credential }))
  }
  async function register(details) { return api.post('/students/register', details) }
  async function registerCompany(details) { return api.post('/companies/register', details) }
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

  const value = useMemo(() => ({ token, user, login, loginWithGoogle, register, registerCompany, logout, isManager: ['ADMIN', 'TPO'].includes(String(user?.role || '').toUpperCase()) }), [token, user])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

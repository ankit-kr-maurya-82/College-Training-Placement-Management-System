import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/auth.js'
import { Notice } from '../../components/Feedback.jsx'

const accountTypes = [
  { id: 'STUDENT', label: 'Student' },
  { id: 'COMPANY', label: 'Company' },
  { id: 'MANAGER', label: 'Admin / TPO' },
]

export default function Login() {
  const { login, user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialRole = accountTypes.some((type) => type.id === searchParams.get('role')) ? searchParams.get('role') : 'STUDENT'
  const [accountType, setAccountType] = useState(initialRole)
  const [form, setForm] = useState({ email: '', password: '', companyName: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (user) return <Navigate to={user.role === 'COMPANY' ? '/company' : ['ADMIN', 'TPO'].includes(user.role) ? '/admin' : '/'} replace />

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const credentials = accountType === 'COMPANY'
        ? { companyName: form.companyName, hrEmail: form.email, hrPassword: form.password }
        : { email: form.email, password: form.password }
      await login(credentials, accountType)
      navigate(accountType === 'MANAGER' ? '/admin' : accountType === 'COMPANY' ? '/company' : '/')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return <section className="auth-card">
    <p className="eyebrow">WELCOME BACK</p>
    <h1>Log in to your account</h1>
    {searchParams.get('registered') === '1' && <Notice>Company registered. Sign in with your HR email and password.</Notice>}
    <div className="auth-switch" role="tablist" aria-label="Account type">
      {accountTypes.map((type) => <button type="button" role="tab" aria-selected={accountType === type.id} className={accountType === type.id ? 'active' : ''} key={type.id} onClick={() => { setAccountType(type.id); setError('') }}>{type.label}</button>)}
    </div>
    <p className="muted">{accountType === 'MANAGER' ? 'Sign in with an Admin or TPO account provisioned by your institution.' : accountType === 'COMPANY' ? 'Use the company name and HR credentials registered with the placement system.' : 'Sign in with your student account.'}</p>
    <Notice error={error}/>
    <form onSubmit={submit} className="form-stack">
      {accountType === 'COMPANY' && <label>Company name<input required autoComplete="organization" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })}/></label>}
      <label>{accountType === 'COMPANY' ? 'HR email' : 'Email'}<input required type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}/></label>
      <label>Password<input required type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}/></label>
      <button className="button" disabled={busy}>{busy ? 'Signing in…' : `Log in as ${accountTypes.find((type) => type.id === accountType)?.label}`}</button>
    </form>
    {accountType !== 'MANAGER' && <p className="muted">New here? <Link to={`/register?role=${accountType}`}>Register {accountType === 'COMPANY' ? 'your company' : 'as a student'}</Link></p>}
    {accountType === 'MANAGER' && <p className="muted">Staff accounts are created by the system administrator; public TPO registration is disabled.</p>}
  </section>
}

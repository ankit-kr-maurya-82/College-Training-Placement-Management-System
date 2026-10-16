import { useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../services/api.js'
import { Notice } from '../../components/Feedback.jsx'

const accountType = (value) => value === 'company' ? 'company' : 'student'

export function ForgotPassword() {
  const [params] = useSearchParams()
  const type = accountType(params.get('type'))
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const processing = useRef(false)
  async function submit(event) {
    event.preventDefault()
    if (processing.current) return
    processing.current = true
    setBusy(true); setError('')
    try {
      await api.post(`/${type === 'student' ? 'students' : 'companies'}/forgot-password`, { email })
      setSent(true)
    } catch (e) { setError(e.message) }
    finally { processing.current = false; setBusy(false) }
  }
  return <section className="auth-card"><p className="eyebrow">ACCOUNT RECOVERY</p><h1>Forgot password?</h1><p className="muted">Enter your {type === 'company' ? 'HR ' : ''}email. If an account matches, we’ll send reset instructions.</p><Notice error={error}/>{sent ? <Notice> If an account matches that email, password reset instructions will be sent. Check your inbox.</Notice> : <form className="form-stack" onSubmit={submit}><label>{type === 'company' ? 'HR email' : 'Email'}<input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}/></label><button className="button" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button></form>}<p className="muted"><Link to={`/login?role=${type.toUpperCase()}`}>Back to login</Link></p></section>
}

export function ResetPassword() {
  const [params] = useSearchParams()
  const type = accountType(params.get('type'))
  const token = params.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const processing = useRef(false)
  async function submit(event) {
    event.preventDefault()
    if (processing.current) return
    if (password !== confirmPassword) { setError('Passwords do not match'); return }
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) { setError('Use at least 8 characters, including an uppercase letter and a number'); return }
    processing.current = true; setBusy(true); setError('')
    try {
      await api.post(`/${type === 'student' ? 'students' : 'companies'}/reset-password`, { token, password, confirmPassword })
      setDone(true)
    } catch (e) { setError(e.message) }
    finally { processing.current = false; setBusy(false) }
  }
  return <section className="auth-card"><p className="eyebrow">ACCOUNT RECOVERY</p><h1>Choose a new password</h1><Notice error={error}/>{done ? <><Notice>Password updated. Sign in with your new password.</Notice><p className="muted"><Link to={`/login?role=${type.toUpperCase()}`}>Go to login</Link></p></> : !token ? <><Notice error="This reset link is invalid or incomplete."/><p className="muted"><Link to={`/forgot-password?type=${type}`}>Request another reset link</Link></p></> : <form className="form-stack" onSubmit={submit}><label>New password<input required type="password" autoComplete="new-password" minLength="8" value={password} onChange={(e) => setPassword(e.target.value)}/><span className="password-hint">At least 8 characters, including an uppercase letter and a number.</span></label><label>Confirm new password<input required type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}/></label><button className="button" disabled={busy}>{busy ? 'Updating…' : 'Reset password'}</button></form>}</section>
}

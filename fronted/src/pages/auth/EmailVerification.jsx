import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../services/api.js'
import { Notice } from '../../components/Feedback.jsx'

const getType = (value) => value === 'company' ? 'company' : 'student'
const endpoint = (type) => type === 'company' ? '/companies' : '/students'

export function VerifyEmail() {
  const [params] = useSearchParams()
  const type = getType(params.get('type'))
  const token = params.get('token') || ''
  const [status, setStatus] = useState(token ? 'loading' : 'error')
  const [message, setMessage] = useState(token ? '' : 'This verification link is incomplete.')
  const started = useRef(false)
  useEffect(() => {
    if (!token || started.current) return
    started.current = true
    api.post(`${endpoint(type)}/verify-email`, { token })
      .then((result) => { setMessage(result.message); setStatus('success') })
      .catch((error) => { setMessage(error.message || 'This verification link is invalid or expired.'); setStatus('error') })
  }, [token, type])
  return <section className="auth-card"><p className="eyebrow">EMAIL VERIFICATION</p><h1>{status === 'loading' ? 'Verifying your email…' : status === 'success' ? 'Email verified' : 'Verification link unavailable'}</h1>{status === 'loading' ? <p className="muted" role="status">Please wait while we verify your email.</p> : <Notice error={status === 'error'}>{message}</Notice>}{status === 'success' ? <p className="muted"><Link to={`/login?role=${type.toUpperCase()}`}>Continue to login</Link></p> : status === 'error' && <p className="muted"><Link to={`/resend-verification?type=${type}`}>Request another verification email</Link></p>}</section>
}

export function ResendVerification() {
  const [params] = useSearchParams()
  const type = getType(params.get('type'))
  const [email, setEmail] = useState(params.get('email') || '')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const processing = useRef(false)
  async function submit(event) {
    event.preventDefault()
    if (processing.current) return
    processing.current = true; setBusy(true); setError('')
    try {
      await api.post(`${endpoint(type)}/resend-verification`, { email })
      setSent(true)
    } catch (requestError) { setError(requestError.message || 'Please try again later.') }
    finally { processing.current = false; setBusy(false) }
  }
  return <section className="auth-card"><p className="eyebrow">EMAIL VERIFICATION</p><h1>Resend verification email</h1><p className="muted">Enter your {type === 'company' ? 'HR ' : ''}email. If the account can be verified, we’ll send a link.</p><Notice error={error}/>{sent ? <Notice>If the account is eligible for verification, an email will be sent shortly.</Notice> : <form className="form-stack" onSubmit={submit}><label>{type === 'company' ? 'HR email' : 'Email'}<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)}/></label><button className="button" disabled={busy}>{busy ? 'Sending…' : 'Resend verification email'}</button></form>}<p className="muted"><Link to={`/login?role=${type.toUpperCase()}`}>Back to login</Link></p></section>
}

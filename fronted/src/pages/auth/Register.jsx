import { useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/auth.js'
import { Busy, Notice } from '../../components/Feedback.jsx'
import { GoogleSignInButton } from '../../components/GoogleSignInButton.jsx'
import { Eye, EyeOff, LockKeyhole, Sparkles } from 'lucide-react'

export default function Register() {
  const { user, register, registerCompany, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [accountType, setAccountType] = useState(searchParams.get('role') === 'COMPANY' ? 'COMPANY' : 'STUDENT')
  const [form, setForm] = useState({ name: '', email: '', password: '', companyName: '', hrName: '', hrPhoneNumber: '', location: '', website: '', description: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const processing = useRef(false)

  if (user) return <Navigate to="/" replace />

  async function submit(event) {
    event.preventDefault()
    if (processing.current) return
    processing.current = true
    setBusy(true)
    setError('')
    try {
      if (accountType === 'STUDENT') {
        await register({ name: form.name, email: form.email, password: form.password })
        setRegisteredEmail(form.email)
      } else {
        await registerCompany({
          companyName: form.companyName,
          hrName: form.hrName,
          hrEmail: form.email,
          hrPassword: form.password,
          hrPhoneNumber: form.hrPhoneNumber,
          location: form.location,
          website: form.website,
          description: form.description,
        })
        setRegisteredEmail(form.email)
      }
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      processing.current = false
      setBusy(false)
    }
  }

  async function signInWithGoogle(credential) {
    if (processing.current) return
    processing.current = true
    setGoogleBusy(true)
    setBusy(true)
    setError('')
    try {
      await loginWithGoogle(credential)
      navigate('/')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      processing.current = false
      setGoogleBusy(false)
      setBusy(false)
    }
  }

  function googleSignInError() {
    setError('Google sign-in was cancelled or could not be started. Try again.')
  }

  const passwordChecks = [form.password.length >= 8, /[A-Z]/.test(form.password), /[0-9]/.test(form.password)]
  const passwordScore = passwordChecks.filter(Boolean).length

  if (registeredEmail) return <section className="auth-card"><p className="eyebrow">CHECK YOUR EMAIL</p><h1>Verify your email address</h1><p className="muted">We sent a verification link to <strong>{registeredEmail}</strong>. Open it within 24 hours before logging in.</p><p className="muted">If the message does not arrive, use the resend option below.</p><a className="button" href={`/resend-verification?type=${accountType.toLowerCase()}&email=${encodeURIComponent(registeredEmail)}`}>Resend verification email</a><p className="muted"><Link to={`/login?role=${accountType}`}>Back to login</Link></p></section>

  return <section className="auth-card auth-card-wide auth-register">
    <div className="auth-welcome"><span className="auth-welcome-icon"><Sparkles size={20}/></span><span>BUILD YOUR NEXT OPPORTUNITY</span></div>
    <p className="eyebrow">GET STARTED</p>
    <h1>{accountType === 'COMPANY' ? 'Register your company' : 'Create your student account'}</h1>
    <div className="auth-switch" role="tablist" aria-label="Account type">
      <button type="button" role="tab" aria-selected={accountType === 'STUDENT'} className={accountType === 'STUDENT' ? 'active' : ''} onClick={() => { setAccountType('STUDENT'); setError('') }}>Student</button>
      <button type="button" role="tab" aria-selected={accountType === 'COMPANY'} className={accountType === 'COMPANY' ? 'active' : ''} onClick={() => { setAccountType('COMPANY'); setError('') }}>Company</button>
    </div>
    <Notice error={error}/>
    {accountType === 'STUDENT' && <>
      <GoogleSignInButton disabled={busy} onCredential={signInWithGoogle} onError={googleSignInError}/>
      {googleBusy && <Busy label="Signing in with Google…"/>}
      <p className="auth-divider">or sign up with email</p>
    </>}
    <form className="form-stack" onSubmit={submit}>
      {accountType === 'STUDENT' ? <label>Full name<input required autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}/></label> : <>
        <label>Company name<input required autoComplete="organization" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })}/></label>
        <label>HR contact name<input required autoComplete="name" value={form.hrName} onChange={(e) => setForm({ ...form, hrName: e.target.value })}/></label>
      </>}
      <label>{accountType === 'COMPANY' ? 'HR email' : 'Email'}<input required type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}/></label>
      <label>Password<div className="password-field"><LockKeyhole size={16}/><input required type={showPassword ? 'text' : 'password'} minLength="8" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}/><button type="button" className="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div><span className="password-hint">Use 8+ characters. Add a number and uppercase letter for a stronger password.</span><span className="password-meter" aria-label={`Password strength: ${passwordScore} of 3`}><i className={passwordScore > 0 ? `level-${passwordScore}` : ''}/><i className={passwordScore > 1 ? `level-${passwordScore}` : ''}/><i className={passwordScore > 2 ? `level-${passwordScore}` : ''}/></span></label>
      {accountType === 'COMPANY' && <>
        <label>HR phone number<input required type="tel" autoComplete="tel" value={form.hrPhoneNumber} onChange={(e) => setForm({ ...form, hrPhoneNumber: e.target.value })}/></label>
        <label>Company location<input required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}/></label>
        <label>Website<input required type="url" placeholder="https://example.com" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })}/></label>
        <label>Company description<textarea required rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}/></label>
      </>}
      <button className="button" disabled={busy}>{busy ? 'Submitting…' : accountType === 'COMPANY' ? 'Register company' : 'Create student account'}</button>
    </form>
    <p className="muted">Already registered? <Link to={`/login?role=${accountType}`}>Log in</Link></p>
    <p className="muted">Admin/TPO accounts are provisioned by the institution. <Link to="/login?role=MANAGER">Staff login</Link></p>
  </section>
}

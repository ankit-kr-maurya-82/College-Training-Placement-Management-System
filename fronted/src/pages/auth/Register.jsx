import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/auth.js'
import { Notice } from '../../components/Feedback.jsx'

export default function Register() {
  const { user, register, registerCompany } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [accountType, setAccountType] = useState(searchParams.get('role') === 'COMPANY' ? 'COMPANY' : 'STUDENT')
  const [form, setForm] = useState({ name: '', email: '', password: '', companyName: '', hrName: '', hrPhoneNumber: '', location: '', website: '', description: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/" replace />

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (accountType === 'STUDENT') {
        await register({ name: form.name, email: form.email, password: form.password })
        navigate('/')
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
        navigate('/login?role=COMPANY&registered=1')
      }
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return <section className="auth-card auth-card-wide">
    <p className="eyebrow">GET STARTED</p>
    <h1>{accountType === 'COMPANY' ? 'Register your company' : 'Create your student account'}</h1>
    <div className="auth-switch" role="tablist" aria-label="Account type">
      <button type="button" role="tab" aria-selected={accountType === 'STUDENT'} className={accountType === 'STUDENT' ? 'active' : ''} onClick={() => { setAccountType('STUDENT'); setError('') }}>Student</button>
      <button type="button" role="tab" aria-selected={accountType === 'COMPANY'} className={accountType === 'COMPANY' ? 'active' : ''} onClick={() => { setAccountType('COMPANY'); setError('') }}>Company</button>
    </div>
    <Notice error={error}/>
    <form className="form-stack" onSubmit={submit}>
      {accountType === 'STUDENT' ? <label>Full name<input required autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}/></label> : <>
        <label>Company name<input required autoComplete="organization" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })}/></label>
        <label>HR contact name<input required autoComplete="name" value={form.hrName} onChange={(e) => setForm({ ...form, hrName: e.target.value })}/></label>
      </>}
      <label>{accountType === 'COMPANY' ? 'HR email' : 'Email'}<input required type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}/></label>
      <label>Password<input required type="password" minLength="8" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}/></label>
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

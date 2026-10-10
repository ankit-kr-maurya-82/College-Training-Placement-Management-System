import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/auth.js'
import { Notice } from '../../components/Feedback.jsx'

export default function Login() {
  const { login, user } = useAuth(); const navigate = useNavigate(); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const [form, setForm] = useState({ email: '', password: '' })
  if (user) return <Navigate to="/" replace />
  async function submit(event) { event.preventDefault(); setBusy(true); setError(''); try { await login(form); navigate('/') } catch (e) { setError(e.message) } finally { setBusy(false) } }
  return <section className="auth-card"><p className="eyebrow">WELCOME BACK</p><h1>Log in to your account</h1><p className="muted">Student login uses the account registered with this placement system.</p><Notice error={error}/><form onSubmit={submit} className="form-stack"><label>Email<input required type="email" autoComplete="email" value={form.email} onChange={e => setForm({...form,email:e.target.value})}/></label><label>Password<input required type="password" autoComplete="current-password" value={form.password} onChange={e => setForm({...form,password:e.target.value})}/></label><button className="button" disabled={busy}>{busy ? 'Signing in…' : 'Log in'}</button></form><p className="muted">New here? <Link to="/register">Create a student account</Link></p></section>
}

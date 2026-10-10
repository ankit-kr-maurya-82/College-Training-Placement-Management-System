import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/auth.js'
import { Notice } from '../../components/Feedback.jsx'

export default function Register() {
  const { register, user } = useAuth(); const navigate = useNavigate(); const [form,setForm] = useState({name:'',email:'',password:''}); const [error,setError] = useState(''); const [busy,setBusy] = useState(false)
  if(user) return <Navigate to="/" replace />
  async function submit(e){e.preventDefault();setBusy(true);setError('');try{await register(form);navigate('/')}catch(err){setError(err.message)}finally{setBusy(false)}}
  return <section className="auth-card"><p className="eyebrow">GET STARTED</p><h1>Create your student account</h1><Notice error={error}/><form className="form-stack" onSubmit={submit}><label>Full name<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Email<input required type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label><label>Password<input required type="password" minLength="8" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></label><button className="button" disabled={busy}>{busy?'Creating account…':'Create account'}</button></form><p className="muted">Already registered? <Link to="/login">Log in</Link></p></section>
}

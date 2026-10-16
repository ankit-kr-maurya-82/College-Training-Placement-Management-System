import { useEffect, useState } from 'react'
import { api } from '../../services/api.js'
import RecruiterNav from '../../components/RecruiterNav.jsx'
import ProfilePictureUpload from '../../components/ProfilePictureUpload.jsx'

export default function RecruiterProfile() {
  const [company, setCompany] = useState(null)
  const [form, setForm] = useState({ hrName: '', hrPhoneNumber: '', website: '', description: '' })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { api.get('/companies/me/profile').then(({ company: profile }) => { setCompany(profile); setForm({ hrName: profile.hrName || '', hrPhoneNumber: profile.hrPhoneNumber || '', website: profile.website || '', description: profile.description || '' }) }).catch((err) => setError(err.message)) }, [])
  async function save(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try { const response = await api.put('/companies/me/profile', form); setCompany(response.company); setNotice('Company profile saved.') }
    catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  return <section className="admin"><div className="dashboard-heading"><div><p className="eyebrow">COMPANY PORTAL</p><h1>Company profile</h1><p className="muted">Keep your organization and recruiter contact details current.</p></div></div><RecruiterNav />{error && <div className="notice error">{error}</div>}{notice && <div className="notice">{notice}</div>}
    {!company ? <div className="state">Loading company profile…</div> : <div className="panel profile-card"><p className="muted"><b>{company.name || company.companyName}</b> · {company.industry || 'Industry not set'} · {company.location}</p><p className="muted">Account email: {company.hrEmail}</p><ProfilePictureUpload endpoint="/companies/me/profile-picture" imageUrl={company.profilePictureUrl} onUploaded={(profilePictureUrl) => setCompany((current) => ({ ...current, profilePictureUrl }))}/><form className="form-stack" onSubmit={save}><div className="form-pair"><label>HR contact name<input value={form.hrName} onChange={(event) => setForm({ ...form, hrName: event.target.value })} /></label><label>HR phone<input value={form.hrPhoneNumber} onChange={(event) => setForm({ ...form, hrPhoneNumber: event.target.value })} /></label></div><label>Website<input type="url" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} /></label><label>Company description<textarea rows="5" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><div className="form-actions"><button className="button" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button></div></form></div>}
  </section>
}

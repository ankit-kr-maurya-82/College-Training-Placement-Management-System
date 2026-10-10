import { useCallback, useEffect, useState } from 'react'
import RecruiterNav from '../../components/RecruiterNav.jsx'
import { api } from '../../services/api.js'

const emptyForm = () => ({ title: '', description: '', jobType: 'Full-time', location: '', workMode: 'Hybrid', ctc: '', applicationDeadline: '', driveDate: '', openings: '1' })

export default function RecruiterDrives() {
  const [drives, setDrives] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const load = useCallback(() => api.get('/companies/me/drives?limit=100').then((data) => setDrives(data.drives || [])).catch((err) => setError(err.message)), [])
  useEffect(() => { load() }, [load])
  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  async function create(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try {
      const body = { ...form, applicationDeadline: new Date(form.applicationDeadline).toISOString(), ...(form.driveDate ? { driveDate: new Date(form.driveDate).toISOString() } : {}), openings: Number(form.openings), requiredSkills: [] }
      if (editingId) { await api.put(`/companies/me/drives/${editingId}`, body); setNotice('Drive updated successfully.') }
      else { await api.post('/companies/me/drives', body); setNotice('Drive created as a draft. Publish it when the details are ready.') }
      setEditingId(''); setForm(emptyForm()); await load()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  async function action(id, actionName) {
    setError(''); setNotice('')
    try {
      if (actionName === 'delete') await api.delete(`/companies/me/drives/${id}`)
      else await api.patch(`/companies/me/drives/${id}/${actionName}`, {})
      setNotice(actionName === 'delete' ? 'Drive deleted.' : `Drive ${actionName === 'publish' ? 'published' : 'closed'}.`); await load()
    } catch (err) { setError(err.message) }
  }
  function edit(drive) {
    setEditingId(drive._id)
    setForm({ title: drive.title || '', description: drive.description || '', jobType: drive.jobType || 'Full-time', location: drive.location || '', workMode: drive.workMode || 'Hybrid', ctc: drive.ctc || '', applicationDeadline: drive.applicationDeadline?.slice(0, 10) || '', driveDate: drive.driveDate?.slice(0, 10) || '', openings: String(drive.openings || 1) })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  return <section className="admin"><div className="dashboard-heading"><div><p className="eyebrow">COMPANY PORTAL</p><h1>Placement drives</h1><p className="muted">Create and manage opportunities belonging to your company.</p></div></div><RecruiterNav />
    {error && <div className="notice error">{error}</div>}{notice && <div className="notice">{notice}</div>}
      <div className="admin-columns"><div><h2>Your drives</h2>{drives.length ? <div className="table-wrap"><table><thead><tr><th>Role</th><th>Status</th><th>Deadline</th><th>Actions</th></tr></thead><tbody>{drives.map((drive) => <tr key={drive._id}><td>{drive.title}<div className="muted">{drive.jobType} · {drive.location}</div></td><td>{drive.status}</td><td>{new Date(drive.applicationDeadline).toLocaleDateString()}</td><td><div className="drive-manage-actions">{['Draft', 'Published'].includes(drive.status) && <button type="button" onClick={() => edit(drive)}>Edit</button>}{drive.status === 'Draft' && <button type="button" onClick={() => action(drive._id, 'publish')}>Publish</button>}{drive.status === 'Published' && <button type="button" onClick={() => action(drive._id, 'close')}>Close</button>}{drive.status === 'Draft' && <button type="button" onClick={() => action(drive._id, 'delete')}>Delete</button>}</div></td></tr>)}</tbody></table></div> : <div className="state">No drives yet. Create one using the form.</div>}</div>
      <form className="panel form-stack" onSubmit={create}><h3>{editingId ? 'Edit drive' : 'Create a drive'}</h3><div className="inline-form">
        <label className="span-two">Job title<input required name="title" value={form.title} onChange={change} maxLength="120" /></label>
        <label>Job type<select name="jobType" value={form.jobType} onChange={change}><option>Full-time</option><option>Internship</option><option>Part-time</option></select></label>
        <label>Work mode<select name="workMode" value={form.workMode} onChange={change}><option>On-site</option><option>Hybrid</option><option>Remote</option></select></label>
        <label>Location<input required name="location" value={form.location} onChange={change} /></label>
        <label>CTC / stipend<input name="ctc" value={form.ctc} onChange={change} placeholder="e.g. ₹8 LPA" /></label>
        <label>Application deadline<input type="date" required name="applicationDeadline" value={form.applicationDeadline} onChange={change} /></label>
        <label>Drive date<input type="date" name="driveDate" value={form.driveDate} onChange={change} /></label>
        <label>Openings<input type="number" required min="1" step="1" name="openings" value={form.openings} onChange={change} /></label>
        <label>Description<textarea required rows="4" name="description" value={form.description} onChange={change} /></label>
      </div><div className="form-actions"><button className="button" disabled={busy}>{busy ? 'Saving…' : editingId ? 'Save changes' : 'Save draft'}</button>{editingId && <button className="button ghost" type="button" onClick={() => { setEditingId(''); setForm(emptyForm()) }}>Cancel</button>}</div></form>
    </div>
  </section>
}

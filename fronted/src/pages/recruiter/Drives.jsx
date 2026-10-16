import { useCallback, useEffect, useRef, useState } from 'react'
import RecruiterNav from '../../components/RecruiterNav.jsx'
import { useAuth } from '../../context/auth.js'
import { api } from '../../services/api.js'

const emptyForm = () => ({ title: '', description: '', jobType: 'Full-time', location: '', workMode: 'Hybrid', ctc: '', applicationDeadline: '', driveDate: '', openings: '1', skills: '', minCGPA: '', allowedBranches: '', graduationYear: '', maxBacklogs: '' })

function reprocessErrorMessage(error) {
  if (error.status === 401) return 'Your company session has expired. Sign in again to manage vacancy notifications.'
  if (error.status === 404) return 'This vacancy was not found or does not belong to your company.'
  if (error.status === 409) {
    if (error.message?.toLowerCase().includes('not accepting applications')) return 'The application deadline has passed or this vacancy is no longer published. Notifications cannot be reprocessed.'
    if (error.message?.toLowerCase().includes('already processing')) return 'Notifications for this vacancy are already being processed. Refresh the status in a moment.'
    return error.message || 'This vacancy cannot be reprocessed right now.'
  }
  if (error.status === 400 || error.status === 422) return error.message || 'The vacancy ID or request is invalid.'
  if (!error.status) return error.message || 'Could not reach the server. Check your connection and try again.'
  return error.message || 'Unable to reprocess vacancy notifications.'
}

function selectionSummaryText(summary) {
  const ineligible = summary?.ineligible
  const ineligibleCount = typeof ineligible === 'number'
    ? ineligible
    : ineligible && typeof ineligible === 'object'
      ? Object.values(ineligible).reduce((total, count) => total + (Number(count) || 0), 0)
      : null
  const counts = [
    ['newly queued', summary?.newlyQueued],
    ['already existing', summary?.alreadyExisting],
    ['failed records', summary?.failedRecords],
    ['ineligible', ineligibleCount],
  ]
  return counts.map(([label, count]) => `${label}: ${Number.isFinite(Number(count)) ? Number(count) : 'not available'}`).join(' · ')
}

export default function RecruiterDrives() {
  const { user, token } = useAuth()
  const isCompany = Boolean(token && String(user?.role || '').toUpperCase() === 'COMPANY')
  const [drives, setDrives] = useState([])
  const [notifications, setNotifications] = useState({})
  const [statusCheckedAt, setStatusCheckedAt] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState('')
  const [busy, setBusy] = useState(false)
  const [processingId, setProcessingId] = useState('')
  const processingLock = useRef(false)
  const [retryingId, setRetryingId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    try {
      const [data, summary] = await Promise.all([api.get('/companies/me/drives?limit=100'), api.get('/companies/me/notifications')])
      setDrives(data.drives || [])
      setNotifications(summary.notifications || {})
      setStatusCheckedAt(new Date())
    } catch (err) { setError(err.message) }
  }, [])

  useEffect(() => { load(); const timer = setInterval(load, 8000); return () => clearInterval(timer) }, [load])

  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))

  async function create(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try {
      const eligibility = { ...(form.minCGPA !== '' ? { minCGPA: Number(form.minCGPA) } : {}), ...(form.allowedBranches.trim() ? { allowedBranches: form.allowedBranches.split(',').map(v => v.trim()).filter(Boolean) } : {}), ...(form.graduationYear !== '' ? { graduationYear: Number(form.graduationYear) } : {}), ...(form.maxBacklogs !== '' ? { maxBacklogs: Number(form.maxBacklogs) } : {}) }
      const body = { ...form, applicationDeadline: new Date(form.applicationDeadline).toISOString(), ...(form.driveDate ? { driveDate: new Date(form.driveDate).toISOString() } : {}), openings: Number(form.openings), requiredSkills: form.skills.split(',').map(v => v.trim()).filter(Boolean), eligibility }
      for (const key of ['skills', 'minCGPA', 'allowedBranches', 'graduationYear', 'maxBacklogs']) delete body[key]
      if (editingId) { await api.put(`/companies/me/drives/${editingId}`, body); setNotice('Drive updated successfully.') }
      else { await api.post('/companies/me/drives', body); setNotice('Drive created as a draft. Publish it when the details are ready.') }
      setEditingId(''); setForm(emptyForm()); await load()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function action(id, actionName) {
    setError(''); setNotice('')
    try {
      let result
      if (actionName === 'delete') result = await api.delete(`/companies/me/drives/${id}`)
      else result = await api.patch(`/companies/me/drives/${id}/${actionName}`, {})
      setNotice(actionName === 'delete' ? 'Drive deleted.' : actionName === 'publish' ? (result.notificationsQueued ? 'Drive published. Student notifications are queued.' : 'Drive published, but notifications could not be queued. Contact the placement administrator.') : 'Drive closed.')
      await load()
    } catch (err) { setError(err.message) }
  }

  async function reprocess(drive) {
    if (!isCompany || processingLock.current || busy) return
    processingLock.current = true
    setProcessingId(drive._id); setError(''); setNotice('')
    try {
      const result = await api.post(`/companies/me/drives/${drive._id}/notifications/reprocess`, {})
      const counts = result.summary ? selectionSummaryText(result.summary) : 'Recipient counts are not available yet.'
      const prefix = result.reprocessQueued ? 'Recipient selection was reprocessed. Delivery is pending.' : 'A notification job is already queued.'
      setNotice(`${drive.title}: ${prefix} ${counts}. Failed deliveries are not retried by this action.`)
      await load()
    } catch (err) { setError(reprocessErrorMessage(err)) } finally { processingLock.current = false; setProcessingId('') }
  }

  async function retryFailed(drive) {
    if (!isCompany || retryingId || busy) return
    setRetryingId(drive._id); setError(''); setNotice('')
    try {
      const result = await api.post(`/companies/me/drives/${drive._id}/notify`, {})
      setNotice(`${result.message || 'Retry request submitted'} for ${drive.title}. ${Number(result.retryCount) || 0} failed deliveries queued for retry.`)
      await load()
    } catch (err) { setError(reprocessErrorMessage(err)) } finally { setRetryingId('') }
  }

  function edit(drive) {
    setEditingId(drive._id)
    setForm({ title: drive.title || '', description: drive.description || '', jobType: drive.jobType || 'Full-time', location: drive.location || '', workMode: drive.workMode || 'Hybrid', ctc: drive.ctc || '', applicationDeadline: drive.applicationDeadline?.slice(0, 10) || '', driveDate: drive.driveDate?.slice(0, 10) || '', openings: String(drive.openings || 1), skills: drive.requiredSkills?.join(', ') || '', minCGPA: drive.eligibility?.minCGPA ?? '', allowedBranches: drive.eligibility?.allowedBranches?.join(', ') || '', graduationYear: drive.eligibility?.graduationYear ?? '', maxBacklogs: drive.eligibility?.maxBacklogs ?? '' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return <section className="admin"><div className="dashboard-heading"><div><p className="eyebrow">COMPANY PORTAL</p><h1>Placement drives</h1><p className="muted">Create and manage opportunities belonging to your company.</p></div></div><RecruiterNav />
    {error && <div className="notice error" role="alert">{error}</div>}{notice && <div className="notice" role="status" aria-live="polite">{notice}</div>}
    <div className="admin-columns"><div><h2>Your drives</h2>{drives.length ? <div className="table-wrap"><table><thead><tr><th>Role</th><th>Status</th><th>Notification status</th><th>Deadline</th><th>Actions</th></tr></thead><tbody>{drives.map((drive) => {
      const summary = notifications[drive._id]
      const deadlineOpen = Number.isFinite(Date.parse(drive.applicationDeadline)) && Date.parse(drive.applicationDeadline) > Date.now()
      const canReprocess = isCompany && drive.status === 'Published' && deadlineOpen
      const canRetry = isCompany && drive.status === 'Published' && (summary?.failed > 0 || summary?.jobStatus === 'FAILED')
      const hasNoNotifications = summary && !summary.sent && !summary.pending && !summary.failed && !summary.jobStatus
      const timestampLabel = (status) => {
        const value = summary?.timestamps?.[status]
        return value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString() : null
      }
      return <tr key={drive._id}>
        <td>{drive.title}<div className="muted">{drive.jobType} · {drive.location}</div></td>
        <td>{drive.status}</td>
        <td><div className="notification-status" aria-label={`Email delivery statuses for ${drive.title}`}>
          <span className="status-count pending">PENDING {summary ? Number(summary.pending) || 0 : '—'}</span>
          <span className="status-count sent">SENT {summary ? Number(summary.sent) || 0 : '—'}</span>
          <span className="status-count failed">FAILED {summary ? Number(summary.failed) || 0 : '—'}</span>
        </div><div className="muted">Job: {summary?.jobStatus || '—'}{statusCheckedAt && <> · Counts checked {statusCheckedAt.toLocaleTimeString()}</>}</div>
          <div className="notification-timestamps" aria-label={`Notification timestamps for ${drive.title}`}>
            {['pending', 'sent', 'failed'].map((status) => timestampLabel(status) && <div key={status} className="muted">Last {status} update: {timestampLabel(status)}</div>)}
          </div>
        </td>
        <td>{new Date(drive.applicationDeadline).toLocaleDateString()}</td>
        <td><div className="drive-manage-actions">
          {['Draft', 'Published'].includes(drive.status) && <button type="button" onClick={() => edit(drive)}>Edit</button>}
          {drive.status === 'Draft' && <button type="button" onClick={() => action(drive._id, 'publish')}>Publish</button>}
          {drive.status === 'Published' && <>
            <button type="button" onClick={() => action(drive._id, 'close')}>Close</button>
            {isCompany && (canReprocess
              ? <button type="button" disabled={Boolean(processingId || retryingId) || busy} onClick={() => reprocess(drive)}>{processingId === drive._id ? 'Reprocessing…' : 'Reprocess notifications'}</button>
              : !deadlineOpen && <span className="muted" title="The application deadline has passed">Deadline passed</span>)}
            {canRetry && <button type="button" disabled={Boolean(processingId || retryingId) || busy} onClick={() => retryFailed(drive)}>{retryingId === drive._id ? 'Queueing retry…' : 'Retry failed deliveries'}</button>}
            {hasNoNotifications && isCompany && !canReprocess && deadlineOpen && <span className="muted">No notification records</span>}
          </>}
          {drive.status === 'Draft' && <button type="button" onClick={() => action(drive._id, 'delete')}>Delete</button>}
        </div></td>
      </tr>
    })}</tbody></table></div> : <div className="state">No drives yet. Create one using the form.</div>}</div>
      <form className="panel form-stack" onSubmit={create}><h3>{editingId ? 'Edit drive' : 'Create a drive'}</h3><div className="inline-form">
        <label className="span-two">Job title<input required name="title" value={form.title} onChange={change} maxLength="120" /></label>
        <label>Job type<select name="jobType" value={form.jobType} onChange={change}><option>Full-time</option><option>Internship</option><option>Part-time</option></select></label>
        <label>Work mode<select name="workMode" value={form.workMode} onChange={change}><option>On-site</option><option>Hybrid</option><option>Remote</option></select></label>
        <label>Location<input required name="location" value={form.location} onChange={change} /></label>
        <label>CTC / stipend<input name="ctc" value={form.ctc} onChange={change} placeholder="e.g. ₹8 LPA" /></label>
        <label>Application deadline<input type="date" required name="applicationDeadline" value={form.applicationDeadline} onChange={change} /></label>
        <label>Drive date<input type="date" name="driveDate" value={form.driveDate} onChange={change} /></label>
        <label>Openings<input type="number" required min="1" step="1" name="openings" value={form.openings} onChange={change} /></label>
        <label>Required skills<input name="skills" value={form.skills} onChange={change} placeholder="React, SQL, Python" /></label>
        <label>Minimum CGPA<input type="number" min="0" max="10" step="0.01" name="minCGPA" value={form.minCGPA} onChange={change} /></label>
        <label>Eligible branches<input name="allowedBranches" value={form.allowedBranches} onChange={change} placeholder="CSE, IT" /></label>
        <label>Graduation year<input type="number" min="1900" step="1" name="graduationYear" value={form.graduationYear} onChange={change} /></label>
        <label>Maximum active backlogs<input type="number" min="0" step="1" name="maxBacklogs" value={form.maxBacklogs} onChange={change} /></label>
        <label>Description<textarea required rows="4" name="description" value={form.description} onChange={change} /></label>
      </div><div className="form-actions"><button className="button" disabled={busy}>{busy ? 'Saving…' : editingId ? 'Save changes' : 'Save draft'}</button>{editingId && <button className="button ghost" type="button" onClick={() => { setEditingId(''); setForm(emptyForm()) }}>Cancel</button>}</div></form>
    </div>
  </section>
}

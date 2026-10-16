import { useCallback, useEffect, useState } from 'react'
import RecruiterNav from '../../components/RecruiterNav.jsx'
import InterviewForm from '../../components/InterviewForm.jsx'
import { api } from '../../services/api.js'
import '../Interviews.css'

const statuses = ['SCHEDULED', 'COMPLETED', 'CANCELLED']

function formatDateTime(value, timeZone) {
  if (!value) return 'Time unavailable'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Time unavailable'
  try { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(date) }
  catch { return date.toLocaleString() }
}

function modeLabel(mode) { return mode === 'ONLINE' ? 'Online' : mode === 'OFFLINE' ? 'In person' : 'Phone' }

function InterviewHistory({ events }) {
  if (!events?.length) return <p className="muted">No interview history recorded.</p>
  return <ol className="interview-history">{events.map((event, index) => <li key={`${event.action}-${event.changedAt || index}`}>
    <b>{event.action}</b><time>{formatDateTime(event.changedAt, event.timeZone)}</time>
    <span>{formatDateTime(event.startAt, event.timeZone)} · {modeLabel(event.mode)}</span>
    {event.note && <p>{event.note}</p>}
  </li>)}</ol>
}

function actionKey() { return globalThis.crypto?.randomUUID?.() || `interview-action-${Date.now()}-${Math.random().toString(36).slice(2)}` }

export default function RecruiterInterviews() {
  const [interviews, setInterviews] = useState([])
  const [applications, setApplications] = useState([])
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [actionId, setActionId] = useState('')
  const [retry, setRetry] = useState(0)

  const load = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      const [interviewData, applicationData] = await Promise.all([
        api.get('/companies/me/interviews', { params: { status: status || undefined, period: 'all', limit: 100 } }),
        api.get('/applications', { params: { limit: 100 } }),
      ])
      setInterviews(interviewData.interviews || [])
      setApplications(applicationData.applications || [])
    } catch (requestError) {
      setError(requestError.message || 'Interview data could not be loaded.')
    } finally { setBusy(false) }
  }, [status])

  useEffect(() => { load() }, [load, retry])

  async function updateInterview(interview, action) {
    if (actionId) return
    if (action === 'cancel' && !window.confirm('Cancel this interview and notify the student?')) return
    if (action === 'complete' && !window.confirm('Mark this interview as completed?')) return
    setActionId(interview._id)
    setError('')
    setNotice('')
    try {
      const result = await api.patch(`/companies/me/interviews/${interview._id}/${action}`, {}, { headers: { 'Idempotency-Key': actionKey() } })
      setNotice(result.message || `Interview ${action}d.`)
      await load()
    } catch (requestError) {
      setError(requestError.message || 'Interview could not be updated.')
    } finally { setActionId('') }
  }

  async function onSaved(result) {
    setNotice(result.message || 'Interview schedule saved; student notification was attempted.')
    await load()
  }

  return <section className="admin interviews-page">
    <div className="dashboard-heading"><div><p className="eyebrow">COMPANY PORTAL</p><h1>Interview coordination</h1><p className="muted">Schedule and manage interviews for your applicants.</p></div></div>
    <RecruiterNav />
    {notice && <p className="notice" role="status">{notice}</p>}
    {error && <div className="notice error" role="alert">{error} <button className="text-button" onClick={() => setRetry((value) => value + 1)}>Retry</button></div>}

    <details className="panel interview-schedule-panel" open>
      <summary>Schedule an interview</summary>
      {applications.length ? <InterviewForm applications={applications} onSaved={onSaved}/> : <p className="muted">There are no applications to schedule yet.</p>}
    </details>

    <div className="interview-list-toolbar">
      <h2>Interviews</h2>
      <label htmlFor="company-interview-status">Filter by status</label>
      <select id="company-interview-status" value={status} onChange={(event) => setStatus(event.target.value)}>
        <option value="">All statuses</option>{statuses.map((value) => <option key={value} value={value}>{value}</option>)}
      </select>
    </div>
    {busy ? <div className="state" role="status">Loading interviews…</div>
      : interviews.length ? <div className="interview-list">{interviews.map((interview) => <article className="panel interview-card" key={interview._id}>
        <div className="interview-card-heading"><div><p className="company-label">{interview.student?.name || 'Student'}{interview.student?.department ? ` · ${interview.student.department}` : ''}</p><h3>{interview.drive?.title || 'Vacancy'}</h3><p className="muted">{formatDateTime(interview.startAt, interview.timeZone)} – {formatDateTime(interview.endAt, interview.timeZone)} ({interview.timeZone})</p></div><span className={`interview-status interview-status-${interview.status.toLowerCase()}`}>{interview.status}</span></div>
        <dl className="interview-facts"><div><dt>Mode</dt><dd>{modeLabel(interview.mode)}</dd></div>{interview.meetingLink && <div><dt>Meeting</dt><dd><a href={interview.meetingLink} target="_blank" rel="noreferrer">Open meeting link</a></dd></div>}{interview.venue && <div><dt>Venue</dt><dd>{interview.venue}</dd></div>}</dl>
        {interview.instructions && <p className="interview-instructions">{interview.instructions}</p>}
        {interview.status === 'SCHEDULED' && <div className="interview-actions"><button className="button ghost" disabled={Boolean(actionId)} onClick={() => updateInterview(interview, 'complete')}>{actionId === interview._id ? 'Saving…' : 'Mark completed'}</button><button className="button ghost" disabled={Boolean(actionId)} onClick={() => updateInterview(interview, 'cancel')}>Cancel interview</button></div>}
        {interview.status === 'SCHEDULED' && <details className="interview-reschedule"><summary>Reschedule</summary><InterviewForm interview={interview} onSaved={onSaved}/></details>}
        <details className="interview-history-panel"><summary>Interview history</summary><InterviewHistory events={interview.events}/></details>
      </article>)}</div>
      : <div className="state">No interviews match this status filter.</div>}
  </section>
}

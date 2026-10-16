import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
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
    <span>{formatDateTime(event.startAt, event.timeZone)} – {formatDateTime(event.endAt, event.timeZone)} · {modeLabel(event.mode)}</span>
    {event.meetingLink && <a href={event.meetingLink} target="_blank" rel="noreferrer">Meeting link</a>}
    {event.venue && <span>{event.venue}</span>}
    {event.note && <p>{event.note}</p>}
  </li>)}</ol>
}

export default function StudentInterviews() {
  const [searchParams, setSearchParams] = useSearchParams()
  const period = ['upcoming', 'past', 'all'].includes(searchParams.get('period')) ? searchParams.get('period') : 'upcoming'
  const status = statuses.includes(searchParams.get('status')) ? searchParams.get('status') : ''
  const [interviews, setInterviews] = useState([])
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)

  const load = useCallback(async (signal) => {
    setBusy(true)
    setError('')
    try {
      const result = await api.get('/students/me/interviews', { params: { period, status: status || undefined, limit: 100 }, signal })
      setInterviews(result.interviews || [])
    } catch (requestError) {
      if (!signal?.aborted && requestError.name !== 'CanceledError' && requestError.code !== 'ERR_CANCELED') setError(requestError.message || 'Interviews could not be loaded.')
    } finally { if (!signal?.aborted) setBusy(false) }
  }, [period, status])

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load, retry])

  function updateFilters(next) {
    const params = new URLSearchParams(searchParams)
    const nextPeriod = next.period ?? period
    const nextStatus = next.status ?? status
    if (nextPeriod && nextPeriod !== 'upcoming') params.set('period', nextPeriod)
    else params.delete('period')
    if (nextStatus) params.set('status', nextStatus)
    else params.delete('status')
    setSearchParams(params)
  }

  return <section className="section interviews-page student-interviews-page">
    <p className="eyebrow">YOUR PLACEMENT SPACE</p>
    <h1>My interviews</h1>
    <p className="muted">Review interview schedules and updates shared by your companies.</p>
    <div className="interview-list-toolbar student-interview-filters">
      <label htmlFor="interview-period">Period</label>
      <select id="interview-period" value={period} onChange={(event) => updateFilters({ period: event.target.value })}>
        <option value="upcoming">Upcoming</option><option value="past">Past and cancelled</option><option value="all">All interviews</option>
      </select>
      <label htmlFor="student-interview-status">Status</label>
      <select id="student-interview-status" value={status} onChange={(event) => updateFilters({ status: event.target.value })}>
        <option value="">All statuses</option>{statuses.map((value) => <option key={value} value={value}>{value}</option>)}
      </select>
    </div>
    {error && <div className="notice error" role="alert">{error} <button className="text-button" onClick={() => setRetry((value) => value + 1)}>Retry</button></div>}
    {busy ? <div className="state" role="status">Loading your interviews…</div>
      : interviews.length ? <div className="interview-list">{interviews.map((interview) => <article className="panel interview-card" key={interview._id}>
        <div className="interview-card-heading"><div><p className="company-label">{interview.company?.name || interview.company?.companyName || 'Company'}</p><h2>{interview.drive?.title || 'Vacancy'}</h2><p className="muted">{formatDateTime(interview.startAt, interview.timeZone)} – {formatDateTime(interview.endAt, interview.timeZone)} ({interview.timeZone})</p></div><span className={`interview-status interview-status-${interview.status.toLowerCase()}`}>{interview.status}</span></div>
        <dl className="interview-facts"><div><dt>Mode</dt><dd>{modeLabel(interview.mode)}</dd></div>{interview.meetingLink && interview.status === 'SCHEDULED' && <div><dt>Meeting</dt><dd><a href={interview.meetingLink} target="_blank" rel="noreferrer">Join interview</a></dd></div>}{interview.venue && <div><dt>Venue</dt><dd>{interview.venue}</dd></div>}</dl>
        {interview.instructions && <p className="interview-instructions">{interview.instructions}</p>}
        <details className="interview-history-panel"><summary>Schedule changes and history</summary><InterviewHistory events={interview.events}/></details>
      </article>)}</div>
      : <div className="state">No interviews found for these filters.</div>}
  </section>
}

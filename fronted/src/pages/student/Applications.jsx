import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../services/api.js'
import { Busy, Empty, Notice } from '../../components/Feedback.jsx'
import Pagination from '../../components/Pagination.jsx'
import { companyName, date, money } from '../../utils/format.js'
import './Applications.css'

const statusOptions = ['Applied', 'Under Review', 'Shortlisted', 'Interview Scheduled', 'Selected', 'Rejected', 'Withdrawn']
const terminalStatuses = new Set(['Selected', 'Rejected', 'Withdrawn'])

function formatDateTime(value) {
  if (!value) return 'Date unavailable'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? 'Date unavailable' : parsed.toLocaleString()
}

function dateTimeValue(value) {
  if (!value) return undefined
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
}

function StatusHistory({ history }) {
  if (!Array.isArray(history) || history.length === 0) {
    return <p className="application-history-empty">No status history has been recorded.</p>
  }
  return <ol className="application-history">
    {history.map((event, index) => <li key={event._id || `${event.status}-${event.changedAt || index}`}>
      <span className="application-history-marker" aria-hidden="true" />
      <div><strong>{event.status}</strong><time dateTime={dateTimeValue(event.changedAt)}>{formatDateTime(event.changedAt)}</time>{event.note && <p>{event.note}</p>}</div>
    </li>)}
  </ol>
}

export default function Applications() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [withdrawing, setWithdrawing] = useState('')
  const [actionError, setActionError] = useState('')
  const filters = useMemo(() => ({
    status: searchParams.get('status') || '',
    page: Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1),
  }), [searchParams])

  const loadApplications = useCallback(async (signal) => {
    setBusy(true)
    setError('')
    try {
      const result = await api.get('/applications/my', {
        params: { page: filters.page, limit: 10, ...(filters.status ? { status: filters.status } : {}) },
        signal,
      })
      setData(result)
    } catch (requestError) {
      if (!signal?.aborted && requestError.name !== 'CanceledError' && requestError.code !== 'ERR_CANCELED') setError(requestError.message || 'Applications could not be loaded.')
    } finally {
      if (!signal?.aborted) setBusy(false)
    }
  }, [filters])

  useEffect(() => {
    const controller = new AbortController()
    loadApplications(controller.signal)
    return () => controller.abort()
  }, [loadApplications, retry])

  function updateQuery(next) {
    const params = new URLSearchParams(searchParams)
    if (next.status) params.set('status', next.status)
    else params.delete('status')
    if (next.page > 1) params.set('page', String(next.page))
    else params.delete('page')
    setSearchParams(params)
  }

  async function withdraw(applicationId) {
    if (withdrawing) return
    if (!window.confirm('Withdraw this application?')) return
    setWithdrawing(applicationId)
    setActionError('')
    try {
      await api.patch(`/applications/${applicationId}/withdraw`, {})
      setRetry((value) => value + 1)
    } catch (requestError) {
      setActionError(requestError.message || 'The application could not be withdrawn. Please try again.')
    } finally {
      setWithdrawing('')
    }
  }

  const applications = data?.applications || []
  const pagination = data?.pagination

  return <section className="section applications-page">
    <p className="eyebrow">YOUR JOURNEY</p>
    <h1>My applications</h1>
    <p className="muted">Track application progress and review updates recorded by the placement team.</p>

    <div className="applications-toolbar">
      <label htmlFor="application-status-filter">Filter by status</label>
      <select id="application-status-filter" value={filters.status} onChange={(event) => updateQuery({ status: event.target.value, page: 1 })}>
        <option value="">All statuses</option>
        {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
      </select>
      {pagination && <span className="muted">{pagination.total} application{pagination.total === 1 ? '' : 's'}</span>}
    </div>

    <Notice error={actionError}/>
    {error ? <div className="state applications-error" role="alert"><p>{error}</p><button className="button ghost" onClick={() => setRetry((value) => value + 1)}>Retry</button></div>
      : busy ? <Busy label="Loading your applications…"/>
        : applications.length ? <>
          <div className="application-list">
            {applications.map((application) => {
              const drive = application.drive
              const company = drive?.company
              const driveId = drive?._id
              return <article className="application-card" key={application._id}>
                <div className="application-card-heading">
                  <div>
                    <p className="company-label">{companyName(company)}</p>
                    <h2>{drive?.title || 'Placement drive details unavailable'}</h2>
                    <p className="muted">Applied {date(application.appliedAt)}{drive?.location ? ` · ${drive.location}` : ''}</p>
                  </div>
                  <div className="application-actions">
                    <span className={`status status-${application.status?.toLowerCase().replaceAll(' ', '-') || 'unknown'}`}>{application.status || 'Status unavailable'}</span>
                    {!terminalStatuses.has(application.status) && <button className="button ghost" disabled={Boolean(withdrawing)} onClick={() => withdraw(application._id)}>{withdrawing === application._id ? 'Withdrawing…' : 'Withdraw'}</button>}
                  </div>
                </div>

                <dl className="application-job-details">
                  <div><dt>Job type</dt><dd>{drive?.jobType || 'Not available'}</dd></div>
                  <div><dt>Work mode</dt><dd>{drive?.workMode || 'Not available'}</dd></div>
                  <div><dt>Compensation</dt><dd>{money(drive?.ctc)}</dd></div>
                  <div><dt>Drive date</dt><dd>{date(drive?.driveDate)}</dd></div>
                  <div><dt>Application deadline</dt><dd>{date(drive?.applicationDeadline)}</dd></div>
                </dl>
                {drive?.description && <p className="application-description">{drive.description}</p>}
                {drive?.requiredSkills?.length > 0 && <div className="application-skills" aria-label="Required skills">{drive.requiredSkills.map((skill) => <span className="tag" key={skill}>{skill}</span>)}</div>}
                {driveId && <Link className="text-link application-drive-link" to={`/drives/${driveId}`}>View drive details →</Link>}

                <details className="application-history-panel">
                  <summary>Status history</summary>
                  <StatusHistory history={application.statusHistory}/>
                </details>
              </article>
            })}
          </div>
          <Pagination pagination={pagination} onPage={(page) => updateQuery({ status: filters.status, page })}/>
        </>
        : <Empty>{filters.status ? <>No applications have the status “{filters.status}”. <button className="text-link applications-clear-filter" onClick={() => updateQuery({ status: '', page: 1 })}>Clear filter</button></> : <>You haven’t applied to a drive yet. <Link to="/drives">Browse current opportunities →</Link></>}</Empty>}
  </section>
}

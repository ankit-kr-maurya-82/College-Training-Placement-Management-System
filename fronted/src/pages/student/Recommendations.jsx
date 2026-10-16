import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../services/api.js'
import Pagination from '../../components/Pagination.jsx'
import { companyName, date, money } from '../../utils/format.js'
import './Recommendations.css'

const eligibilityFilters = [
  ['', 'All eligibility states'],
  ['ELIGIBLE', 'Eligible'],
  ['INCOMPLETE', 'Profile information missing'],
  ['NOT_ELIGIBLE', 'Not eligible'],
]

function statusLabel(status) {
  return status === 'ELIGIBLE' ? 'Eligible' : status === 'INCOMPLETE' ? 'Profile needs information' : 'Not eligible'
}

function MatchRequirements({ title, items, empty }) {
  return <div className="recommendation-requirements"><h4>{title}</h4>{items.length
    ? <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
    : <p className="muted">{empty}</p>}</div>
}

export default function Recommendations() {
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [applyingId, setApplyingId] = useState('')
  const [applyError, setApplyError] = useState('')
  const [notice, setNotice] = useState('')
  const search = params.get('search') || ''
  const eligibility = params.get('eligibility') || ''
  const jobType = params.get('jobType') || ''
  const workMode = params.get('workMode') || ''
  const sort = params.get('sort') || 'match'
  const page = Number(params.get('page') || 1)

  const load = useCallback(async (signal) => {
    setBusy(true)
    setError('')
    try {
      const result = await api.get('/drives/recommendations', {
        params: { search: search || undefined, eligibility: eligibility || undefined, jobType: jobType || undefined, workMode: workMode || undefined, sort, page, limit: 9 },
        signal,
      })
      if (!signal?.aborted) setData(result)
    } catch (requestError) {
      if (!signal?.aborted && requestError.name !== 'CanceledError' && requestError.code !== 'ERR_CANCELED') setError(requestError.message || 'Recommendations could not be loaded.')
    } finally { if (!signal?.aborted) setBusy(false) }
  }, [search, eligibility, jobType, workMode, sort, page])

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load, retry])

  function updateParams(updates) {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, String(value))
      else next.delete(key)
    }
    if (!Object.hasOwn(updates, 'page')) next.delete('page')
    setParams(next)
  }

  async function apply(driveId) {
    if (applyingId) return
    setApplyingId(driveId)
    setApplyError('')
    setNotice('')
    try {
      await api.post('/applications', { driveId })
      setNotice('Application submitted. You can track it from My applications.')
      setData((current) => current && ({ ...current, recommendations: current.recommendations.map((item) => item.drive._id === driveId ? { ...item, applicationStatus: 'Applied' } : item) }))
    } catch (requestError) {
      setApplyError(requestError.message || 'Application could not be submitted.')
    } finally { setApplyingId('') }
  }

  return <section className="section recommendations-page">
    <div className="section-heading"><div><p className="eyebrow">MATCHED TO YOUR PROFILE</p><h1>Recommended for you</h1><p className="muted">See how each active drive matches your saved skills and academic details.</p></div><Link className="text-link" to="/profile">Update profile →</Link></div>
    <form className="recommendation-filters" onSubmit={(event) => { event.preventDefault(); updateParams({ search: event.currentTarget.elements.search.value }) }}>
      <label className="recommendation-search">Search opportunities<input name="search" aria-label="Search recommendations" defaultValue={search} maxLength="100" placeholder="Title, company, skill, or location" /></label>
      <label>Eligibility<select aria-label="Filter by eligibility" value={eligibility} onChange={(event) => updateParams({ eligibility: event.target.value })}>{eligibilityFilters.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Job type<select aria-label="Filter by job type" value={jobType} onChange={(event) => updateParams({ jobType: event.target.value })}><option value="">All job types</option>{['Full-time', 'Internship', 'Part-time'].map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Work mode<select aria-label="Filter by work mode" value={workMode} onChange={(event) => updateParams({ workMode: event.target.value })}><option value="">All work modes</option>{['On-site', 'Hybrid', 'Remote'].map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Sort by<select aria-label="Sort recommendations" value={sort} onChange={(event) => updateParams({ sort: event.target.value })}><option value="match">Best match</option><option value="deadline">Application deadline</option><option value="newest">Newest</option></select></label>
      <button className="button" type="submit">Search</button>
    </form>
    <p className="recommendation-method">Match scores compare supported profile details with each drive’s stated requirements. Missing profile details score as unmatched. Skills are recommendations; only the listed academic eligibility rules determine eligibility.</p>
    {notice && <p className="notice" role="status">{notice} <Link to="/applications">View applications</Link></p>}
    {applyError && <p className="notice error" role="alert">{applyError}</p>}
    {error && <div className="notice error" role="alert">{error} <button className="text-button" onClick={() => setRetry((value) => value + 1)}>Retry</button></div>}
    {busy ? <div className="state" role="status">Finding opportunities for your profile…</div>
      : data?.recommendations?.length ? <>
        <div className="recommendation-list">{data.recommendations.map((item) => {
          const drive = item.drive
          const alreadyApplied = Boolean(item.applicationStatus)
          return <article className="panel recommendation-card" key={drive._id}>
            <div className="recommendation-card-heading"><div><p className="company-label">{companyName(drive.company)} · {drive.jobType}</p><h2><Link to={`/drives/${drive._id}`}>{drive.title}</Link></h2><p className="muted">{drive.location} · {drive.workMode} · {money(drive.ctc)}</p></div><div className="recommendation-score">{item.matchScore == null ? '—' : `${item.matchScore}%`}<span>match</span></div></div>
            <div className="recommendation-badges"><span className={`recommendation-eligibility recommendation-${item.eligibilityStatus.toLowerCase()}`}>{statusLabel(item.eligibilityStatus)}</span><span>Apply by {date(drive.applicationDeadline)}</span>{drive.driveDate && <span>Drive date {date(drive.driveDate)}</span>}</div>
            <div className="recommendation-match-grid"><MatchRequirements title="Matched requirements" items={item.matchedRequirements} empty="No configured requirements matched yet."/><MatchRequirements title="Requirements to address" items={item.missingRequirements} empty="No listed requirements are missing."/></div>
            <div className="recommendation-action">{alreadyApplied ? <span className="muted">Application status: <b>{item.applicationStatus}</b></span>
              : item.eligibilityStatus !== 'ELIGIBLE' ? <span className="muted">Review your profile against the eligibility details before applying.</span>
                : !data.profile?.hasResume ? <span className="muted">Add a resume URL in <Link to="/profile">your profile</Link> before applying.</span>
                  : <button className="button" disabled={Boolean(applyingId)} onClick={() => apply(drive._id)}>{applyingId === drive._id ? 'Submitting…' : 'Apply now'}</button>}
              <Link className="text-link" to={`/drives/${drive._id}`}>View details →</Link>
            </div>
          </article>
        })}</div>
        <Pagination pagination={data.pagination} onPage={(value) => updateParams({ page: value })}/>
      </> : <div className="state">No active vacancies match these filters. Try a different search or check back later.</div>}
  </section>
}

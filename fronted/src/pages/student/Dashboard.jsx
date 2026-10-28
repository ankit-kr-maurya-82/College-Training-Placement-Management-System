import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowDown, ArrowRight, ArrowUpRight, BriefcaseBusiness, MapPin } from 'lucide-react'
import { api } from '../../services/api.js'
import { useAuth } from '../../context/auth.js'
import { Busy, Empty, Notice } from '../../components/Feedback.jsx'
import DriveCard from '../../components/JobCard.jsx'
import Pagination from '../../components/Pagination.jsx'
import { companyName } from '../../utils/format.js'

const filterKeys = ['search', 'company', 'location', 'jobType', 'workMode', 'page']
const jobTypes = ['Full-time', 'Internship', 'Part-time']
const workModes = ['On-site', 'Hybrid', 'Remote']

export default function Drives({ showHero = true }) {
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [companies, setCompanies] = useState([])
  const filters = useMemo(() => Object.fromEntries(filterKeys.map((key) => [key, params.get(key) || ''])), [params])
  const drives = data?.drives || []
  const total = data?.pagination?.total
  const hasFilters = ['search', 'company', 'location', 'jobType', 'workMode'].some((key) => filters[key])

  useEffect(() => {
    api.get('/companies?limit=100').then((response) => setCompanies(response.companies || [])).catch(() => {})
  }, [])

  useEffect(() => {
    let live = true
    setBusy(true)
    setError('')
    api.get('/drives', { params: { ...filters, page: filters.page || 1, limit: 9 } })
      .then((response) => { if (live) setData(response) })
      .catch((requestError) => { if (live) setError(requestError.message) })
      .finally(() => { if (live) setBusy(false) })
    return () => { live = false }
  }, [filters])

  function updateFilter(key, value) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next)
  }

  function clearFilters() {
    const next = new URLSearchParams(params)
    filterKeys.forEach((key) => next.delete(key))
    setParams(next)
  }

  return <>
    {showHero && <section className="hero hero-studio">
      <div className="hero-copy">
        <p className="hero-kicker"><span/>PLACEMENT OPPORTUNITIES</p>
        <h1>Current placement<br/><em>drives</em></h1>
        <p className="hero-description">Review open roles, application deadlines, and work details from employers on your placement portal.</p>
        <div className="hero-actions">
          <a className="button" href="#open-positions">Browse open drives <ArrowDown size={16}/></a>
          <Link className="hero-secondary-link" to="/companies">Company directory <ArrowUpRight size={16}/></Link>
        </div>
        <div className="hero-facts" aria-label="Placement overview">
          <div className="hero-fact"><BriefcaseBusiness size={17}/><span><b>{total ?? '—'}</b> active drives</span></div>
        </div>
      </div>
      <div className="hero-side">
        <article className="hero-feature">
          <div className="hero-feature-top"><span>ACTIVE DRIVE</span><span className="hero-live"><i/>OPEN</span></div>
          {drives[0] ? <Link className="hero-feature-link" to={`/drives/${drives[0]._id}`}>
            <div className="hero-feature-company"><span className="company-mark">{companyName(drives[0].company).slice(0, 1).toUpperCase()}</span><span>{companyName(drives[0].company)}</span></div>
            <h2>{drives[0].title}</h2>
            <p><MapPin size={15}/>{drives[0].location}<span>·</span>{drives[0].workMode}</p>
            <span className="hero-feature-cta">See opportunity <ArrowUpRight size={16}/></span>
          </Link> : <p className="hero-feature-empty">{busy ? 'Loading current roles…' : 'New opportunities will appear here.'}</p>}
        </article>
      </div>
    </section>}

    <section className={`section roles-section${showHero ? '' : ' roles-dashboard'}`} id="open-positions">
      <div className="section-heading roles-heading"><div><p className="eyebrow">OPEN POSITIONS</p><h2>Current placement drives</h2><p className="muted">Review openings and filter by company, location, job type, or work mode.</p></div><span className="roles-count">{total ?? '—'} <small>{total === 1 ? 'active drive' : 'active drives'}</small></span></div>
      <div className="roles-filters">
        <div className="roles-filter-heading"><div><b>Filter drives</b><span>Search by title, skill, company, or location.</span></div>{hasFilters && <button className="filter-reset" type="button" onClick={clearFilters}>Clear filters</button>}</div>
        <div className="filters">
          <input aria-label="Search drives" placeholder="Search roles, skills, or keywords" value={filters.search} onChange={(event) => updateFilter('search', event.target.value)}/>
          <select aria-label="Company" value={filters.company} onChange={(event) => updateFilter('company', event.target.value)}><option value="">All companies</option>{companies.map((company) => <option key={company._id} value={company._id}>{companyName(company)}</option>)}</select>
          <input aria-label="Location" placeholder="Location" value={filters.location} onChange={(event) => updateFilter('location', event.target.value)}/>
          <select aria-label="Job type" value={filters.jobType} onChange={(event) => updateFilter('jobType', event.target.value)}><option value="">All job types</option>{jobTypes.map((value) => <option key={value}>{value}</option>)}</select>
          <select aria-label="Work mode" value={filters.workMode} onChange={(event) => updateFilter('workMode', event.target.value)}><option value="">All work modes</option>{workModes.map((value) => <option key={value}>{value}</option>)}</select>
        </div>
      </div>
      {error && <Notice error={error}/>}
      {busy ? <Busy/> : drives.length ? <><div className="drive-grid">{drives.map((drive) => <DriveCard key={drive._id} drive={drive}/>)}</div><Pagination pagination={data.pagination} onPage={(page) => updateFilter('page', String(page))}/></> : <Empty>No open roles match those filters. Try clearing a filter.</Empty>}
    </section>

    {showHero && <>
      <section className="section employer-showcase" aria-labelledby="employer-heading">
        <div className="section-heading"><div><p className="eyebrow">EMPLOYER DIRECTORY</p><h2 id="employer-heading">Companies on the portal</h2><p className="muted">Browse employer profiles and see their current opportunities.</p></div><Link className="text-link" to="/companies">View all companies <ArrowRight size={15}/></Link></div>
        {companies.length ? <div className="employer-preview-grid">{companies.slice(0, 6).map((company) => <Link className="employer-preview" to={`/companies/${company._id}`} key={company._id}>
          <span className="company-mark" aria-hidden="true">{companyName(company).slice(0, 1).toUpperCase()}</span>
          <span className="employer-preview-copy"><b>{companyName(company)}</b><small>{[company.industry, company.location].filter(Boolean).join(' · ') || 'Employer profile'}</small></span>
          <ArrowUpRight size={16}/>
        </Link>)}</div> : <p className="muted">Employer profiles will appear here when they are added to the directory.</p>}
      </section>

      <section className="placement-process" aria-labelledby="process-heading">
        <div className="process-intro"><p className="eyebrow">HOW PLACEMENT WORKS</p><h2 id="process-heading">From profile to application</h2><p>Use the portal to find current drives and follow your application progress.</p><Link className="text-link" to="/register?role=STUDENT">Create a student account <ArrowRight size={15}/></Link></div>
        <ol className="process-steps">
          <li><span>01</span><div><b>Complete your profile</b><p>Add your course, academic details, skills, and resume link.</p></div></li>
          <li><span>02</span><div><b>Review open drives</b><p>Check each role’s details and application deadline before applying.</p></div></li>
          <li><span>03</span><div><b>Track your progress</b><p>Review application updates, interview schedules, and placement office announcements.</p></div></li>
        </ol>
      </section>

      <section className="recruiter-promo">
        <div><p className="eyebrow">FOR EMPLOYERS</p><h2>Recruit through the placement cell</h2><p>Create a company account to publish drives, manage applications, and coordinate interviews.</p></div>
        <Link className="button" to="/register?role=COMPANY">Register your company <ArrowUpRight size={16}/></Link>
      </section>
    </>}
  </>
}

export function Home() {
  const { user } = useAuth()
  const [summary, setSummary] = useState(null)
  const isStudent = String(user?.role || '').toUpperCase() === 'STUDENT'

  useEffect(() => {
    if (isStudent) api.get('/applications/my', { params: { limit: 5 } }).then(setSummary).catch(() => {})
  }, [isStudent])

  return <>
    {isStudent && <>
      <section className="welcome-strip"><div><p className="eyebrow">YOUR PLACEMENT SPACE</p><h2>Welcome back, {user.name?.split(' ')[0] || 'there'}.</h2><p>Pick up where you left off and keep moving forward.</p></div><div className="welcome-stat"><b>{summary?.pagination?.total ?? '—'}</b><span>applications</span></div><Link className="button" to="/applications">Track applications <ArrowRight size={16}/></Link></section>
      <ReadinessSummary/>
    </>}
    <Drives showHero={!isStudent}/>
  </>
}

function ReadinessSummary() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let live = true
    setError('')
    api.get('/students/me/readiness')
      .then((result) => { if (live) setData(result.readiness) })
      .catch((requestError) => { if (live) setError(requestError.message) })
    return () => { live = false }
  }, [retry])

  return <section className="readiness-summary" aria-labelledby="readiness-heading">
    <div><p className="eyebrow">SKILLS FOR OPEN ROLES</p><h2 id="readiness-heading">Your placement readiness</h2>
      {error ? <p className="readiness-message" role="alert">{error} <button className="text-button" onClick={() => setRetry((value) => value + 1)}>Retry</button></p> : !data ? <p className="readiness-message" role="status">Checking your profile against current role requirements…</p> : <>
        <p className="readiness-message">{data.totalDemandOccurrences ? <>Your profile lists <strong>{data.matchedDemandOccurrences} of {data.totalDemandOccurrences}</strong> skill requirements across {data.activeDriveCount} open roles ({data.skillCoveragePercentage}% exact-name coverage).</> : <>No required skills are currently listed on open drives.</>}</p>
        {data.missingSkills.length > 0 && <div className="readiness-skill-list" aria-label="Frequently requested skills missing from your profile">{data.missingSkills.slice(0, 5).map((item) => <span className="tag" key={item.skill}>{item.skill} · {item.driveCount} drives</span>)}</div>}
        <p className="readiness-note">This compares profile text with listed requirements; it does not measure proficiency or eligibility.</p>
      </>}
    </div>
    <div className="readiness-actions"><Link className="button" to="/profile">Update my profile</Link><Link className="text-link" to="/recommendations">View matched roles <ArrowRight size={14}/></Link></div>
  </section>
}

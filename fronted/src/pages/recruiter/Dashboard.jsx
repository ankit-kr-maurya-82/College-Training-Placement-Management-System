import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import RecruiterNav from '../../components/RecruiterNav.jsx'
import { api } from '../../services/api.js'
import { useAuth } from '../../context/auth.js'

export default function RecruiterDashboard() {
  const { user } = useAuth()
  const [dashboard, setDashboard] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { api.get('/companies/me/dashboard').then((data) => setDashboard(data.dashboard)).catch((err) => setError(err.message)) }, [])
  const stats = dashboard?.stats
  return <section className="admin">
    <div className="dashboard-heading"><div><p className="eyebrow">COMPANY PORTAL</p><h1>Recruiter dashboard</h1><p className="muted">Manage your placement drives and review student applications.</p></div><Link className="button" to="/company/drives">Create a drive</Link></div>
    <RecruiterNav />
    {error && <div className="notice error">{error}</div>}
    <div className="company-welcome"><h2>Welcome, {dashboard?.company?.name || user?.name || 'recruiter'}</h2><p>Here is the latest activity across your placement drives.</p></div>
    <div className="stat-grid"><div className="stat-card"><span>Total drives</span><b>{stats?.drives ?? '—'}</b></div><div className="stat-card"><span>Published</span><b>{stats?.published ?? '—'}</b></div><div className="stat-card"><span>Applications</span><b>{stats?.applications ?? '—'}</b></div><div className="stat-card"><span>Shortlisted</span><b>{stats?.shortlisted ?? '—'}</b></div></div>
    <div className="dashboard-section"><div className="section-heading"><h2>Recent drives</h2><Link className="text-link" to="/company/drives">View all <span>→</span></Link></div>
      {!dashboard && !error ? <div className="state">Loading your dashboard…</div> : dashboard?.drives?.length ? <div className="table-wrap"><table><thead><tr><th>Role</th><th>Status</th><th>Applications deadline</th><th>Drive date</th></tr></thead><tbody>{dashboard.drives.slice(0, 5).map((drive) => <tr key={drive._id}><td><Link to="/company/drives">{drive.title}</Link></td><td>{drive.status}</td><td>{drive.applicationDeadline ? new Date(drive.applicationDeadline).toLocaleDateString() : '—'}</td><td>{drive.driveDate ? new Date(drive.driveDate).toLocaleDateString() : '—'}</td></tr>)}</tbody></table></div> : <div className="state">No drives yet. <Link to="/company/drives">Create your first drive</Link>.</div>}
    </div>
    <div className="dashboard-section"><h2>Applicant status</h2><div className="status-counts">{Object.entries(dashboard?.applicationsByStatus || {}).map(([status, count]) => <span className="tag" key={status}>{status}: {count}</span>)}{dashboard && !Object.keys(dashboard.applicationsByStatus || {}).length && <span className="muted">No applications yet.</span>}</div></div>
  </section>
}

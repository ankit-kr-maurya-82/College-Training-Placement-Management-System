import { useEffect, useState } from 'react'
import { api } from '../../services/api.js'
import RecruiterNav from '../../components/RecruiterNav.jsx'

const transitions = { Applied: ['Under Review', 'Shortlisted', 'Rejected'], 'Under Review': ['Shortlisted', 'Interview Scheduled', 'Rejected'], Shortlisted: ['Interview Scheduled', 'Selected', 'Rejected'], 'Interview Scheduled': ['Selected', 'Rejected'] }

export default function RecruiterApplications() {
  const [applications, setApplications] = useState([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  async function load() {
    try { const data = await api.get('/applications?limit=100'); setApplications(data.applications || []) }
    catch (err) { setError(err.message) }
  }
  useEffect(() => { load() }, [])
  async function setStatus(id, status) {
    setError(''); setNotice('')
    try { await api.patch(`/applications/${id}/status`, { status }); setNotice(`Application moved to ${status}.`); await load() }
    catch (err) { setError(err.message) }
  }
  return <section className="admin"><div className="dashboard-heading"><div><p className="eyebrow">COMPANY PORTAL</p><h1>Applicants</h1><p className="muted">Review applications submitted to your placement drives.</p></div></div><RecruiterNav />{error && <div className="notice error">{error}</div>}{notice && <div className="notice">{notice}</div>}
    {applications.length ? <div className="table-wrap"><table><thead><tr><th>Student</th><th>Drive</th><th>Applied</th><th>Resume</th><th>Status</th><th>Update status</th></tr></thead><tbody>{applications.map((application) => <tr key={application._id}><td>{application.student?.name || 'Student'}<div className="muted">{[application.student?.department, application.student?.course].filter(Boolean).join(' · ')}</div></td><td>{application.drive?.title || 'Drive'}</td><td>{application.appliedAt ? new Date(application.appliedAt).toLocaleDateString() : '—'}</td><td>{application.resumeUrl ? <a href={application.resumeUrl} target="_blank" rel="noreferrer">View resume</a> : '—'}</td><td>{application.status}</td><td>{transitions[application.status]?.length ? <select aria-label={`Update ${application.student?.name || 'student'} status`} value="" onChange={(event) => setStatus(application._id, event.target.value)}><option value="" disabled>Choose…</option>{transitions[application.status].map((status) => <option value={status} key={status}>{status}</option>)}</select> : <span className="muted">Final</span>}</td></tr>)}</tbody></table></div> : <div className="state">No applications to show yet.</div>}
  </section>
}

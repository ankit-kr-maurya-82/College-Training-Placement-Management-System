import { Link } from 'react-router-dom'
import RecruiterNav from '../../components/RecruiterNav.jsx'

export default function RecruiterInterviews() {
  return <section className="admin"><div className="dashboard-heading"><div><p className="eyebrow">COMPANY PORTAL</p><h1>Interview coordination</h1><p className="muted">Continue reviewing candidates for your open drives.</p></div></div><RecruiterNav /><div className="state">Interview scheduling is currently handled by the placement office. Your company can manage applicant review and shortlist candidates from the <Link to="/company/applications">Applicants page</Link>.</div></section>
}

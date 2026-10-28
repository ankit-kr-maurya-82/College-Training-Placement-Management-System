import { Link } from 'react-router-dom'
import { ArrowUpRight, CalendarDays, MapPin } from 'lucide-react'
import { companyName, date, money } from '../utils/format.js'

export default function DriveCard({ drive }) {
  const company = companyName(drive.company)

  return <article className="drive-card">
    <div className="card-top"><span className="company-mark" aria-hidden="true">{company.slice(0, 1).toUpperCase()}</span><span className="tag">{drive.jobType}</span></div>
    <p className="company-label">{company}</p>
    <h3><Link to={`/drives/${drive._id}`}>{drive.title}</Link></h3>
    <p className="drive-card-location"><MapPin size={14}/><span>{drive.location}</span><i>·</i><span>{drive.workMode}</span></p>
    <div className="card-meta"><span className="drive-package">{money(drive.ctc)}</span><span className="drive-deadline"><CalendarDays size={13}/><span>Apply by {date(drive.applicationDeadline)}</span></span></div>
    <Link className="text-link" to={`/drives/${drive._id}`}>View opportunity <ArrowUpRight size={15}/></Link>
  </article>
}

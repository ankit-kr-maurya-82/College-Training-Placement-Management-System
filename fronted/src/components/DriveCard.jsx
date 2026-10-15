import { Link } from 'react-router-dom'
import { companyName, date, money } from '../utils/format.js'

export default function DriveCard({drive}) {return <article className="drive-card"><div className="card-top"><span className="company-mark">{companyName(drive.company).slice(0,1).toUpperCase()}</span><span className="tag">{drive.jobType}</span></div><p className="company-label">{companyName(drive.company)}</p><h3><Link to={`/drives/${drive._id}`}>{drive.title}</Link></h3><p className="muted">{drive.location} · {drive.workMode}</p><div className="card-meta"><span>{money(drive.ctc)}</span><span>Apply by {date(drive.applicationDeadline)}</span></div><Link className="text-link" to={`/drives/${drive._id}`}>View opportunity <span>→</span></Link></article>}

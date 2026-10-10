import { NavLink } from 'react-router-dom'

const links = [
  ['/company', 'Overview'],
  ['/company/drives', 'My drives'],
  ['/company/applications', 'Applicants'],
  ['/company/interviews', 'Interviews'],
  ['/company/profile', 'Company profile'],
]

export default function RecruiterNav() {
  return <nav className="admin-tabs recruiter-tabs" aria-label="Company dashboard">
    {links.map(([to, label]) => <NavLink key={to} to={to} end={to === '/company'} className={({ isActive }) => isActive ? 'active' : ''}>{label}</NavLink>)}
  </nav>
}

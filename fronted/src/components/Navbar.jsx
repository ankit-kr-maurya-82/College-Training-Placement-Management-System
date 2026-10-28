import { Link, NavLink, useLocation } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { useAuth } from '../context/auth.js'

export default function Navbar() {
  const { user, logout, isManager } = useAuth()
  const { pathname } = useLocation()
  const isAuthPage = pathname === '/login' || pathname === '/register'
  const isCompany = String(user?.role || '').toUpperCase() === 'COMPANY'
  const isStudent = String(user?.role || '').toUpperCase() === 'STUDENT'

  if (isAuthPage && !user) return <header className="topbar auth-topbar">
    <Link className="auth-back-home" to="/"><span aria-hidden="true">←</span><span className="auth-back-label">Back to home</span></Link>
    <div className={`auth-top-actions${pathname === '/register' ? ' is-register' : ''}`} aria-label="Account access">
      <Link className={pathname === '/login' ? 'current' : ''} aria-current={pathname === '/login' ? 'page' : undefined} to="/login">Log in</Link>
      <Link className={pathname === '/register' ? 'current' : ''} aria-current={pathname === '/register' ? 'page' : undefined} to="/register">Create account</Link>
    </div>
  </header>

  return <header className="topbar">
    <Link className="brand" to="/"><span className="brand-monogram">CT</span><span className="brand-name"><b>CTPM</b><small>Training &amp; Placement</small></span></Link>
    <nav aria-label="Main navigation">
      <NavLink to="/drives" className={({ isActive }) => isActive ? 'active' : ''}>Explore roles</NavLink>
      <NavLink to="/companies" className={({ isActive }) => isActive ? 'active' : ''}>Companies</NavLink>
      {isStudent && <details key={pathname} className={`topbar-menu${['/recommendations', '/applications', '/interviews', '/announcements', '/profile'].some((path) => pathname.startsWith(path)) ? ' active' : ''}`}>
        <summary>My placement <ChevronDown size={14}/></summary>
        <div className="topbar-menu-list">
          <NavLink to="/recommendations">Recommended roles</NavLink>
          <NavLink to="/applications">My applications</NavLink>
          <NavLink to="/interviews">Interviews</NavLink>
          <NavLink to="/announcements">Announcements</NavLink>
          <NavLink to="/profile">My profile</NavLink>
        </div>
      </details>}
      {isManager && <details key={pathname} className={`topbar-menu${pathname.startsWith('/admin') ? ' active' : ''}`}>
        <summary>Manage <ChevronDown size={14}/></summary>
        <div className="topbar-menu-list">
          <NavLink to="/admin" end>Overview</NavLink>
          <NavLink to="/admin/companies">Companies</NavLink>
          <NavLink to="/admin/drives">Placement drives</NavLink>
          <NavLink to="/admin/applications">Applications</NavLink>
          <NavLink to="/admin/students">Students</NavLink>
          <NavLink to="/admin/reports">Reports</NavLink>
          <NavLink to="/admin/announcements">Announcements</NavLink>
          {String(user?.role || '').toUpperCase() === 'ADMIN' && <NavLink to="/admin/staff">Staff accounts</NavLink>}
        </div>
      </details>}
      {isCompany && <NavLink to="/company" className={({ isActive }) => isActive ? 'active' : ''}>Company portal</NavLink>}
    </nav>
    <div className="account">{user ? <><span className="account-name">{user.name || user.email}</span><button className="button ghost" onClick={logout}>Log out</button></> : <><Link to="/login">Log in</Link><Link className="button small" to="/register">Create account</Link></>}</div>
  </header>
}

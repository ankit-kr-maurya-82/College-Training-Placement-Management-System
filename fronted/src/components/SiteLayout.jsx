import { Link, Navigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { useAuth } from '../context/auth.js'
import Navbar from './Navbar.jsx'

export function Shell({ children }) {
  const { pathname, hash } = useLocation()
  const { user, isManager } = useAuth()
  const role = String(user?.role || '').toUpperCase()
  const isStudent = role === 'STUDENT'
  const isCompany = role === 'COMPANY'

  useEffect(() => {
    if (hash) document.querySelector(hash)?.scrollIntoView()
    else window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [pathname, hash])

  return <div className="app-shell">
    <Navbar/>
    <main>{children}</main>
    <footer className="site-footer">
      <div className="site-footer-main">
        <div className="site-footer-about">
          <Link className="footer-brand" to="/" aria-label="CTPM home"><span className="footer-brand-mark">CT</span><span><b>CTPM</b><small>Training &amp; Placement</small></span></Link>
          <p>A shared portal for students, employers, and the college placement office to manage opportunities and application progress.</p>
        </div>
        <nav className="footer-links" aria-label="For students">
          <h2>For students</h2>
          <Link to="/drives">Browse placement drives</Link>
          <Link to="/companies">Company directory</Link>
          {isStudent ? <Link to="/applications">My applications</Link> : !user && <Link to="/login?role=STUDENT">Student sign in</Link>}
        </nav>
        <nav className="footer-links" aria-label="For employers">
          <h2>For employers</h2>
          {isCompany ? <><Link to="/company">Company dashboard</Link><Link to="/company/drives">Manage placement drives</Link></> : !user && <><Link to="/register?role=COMPANY">Register your company</Link><Link to="/login?role=COMPANY">Employer sign in</Link></>}
          <Link to="/drives">View current drives</Link>
        </nav>
        <div className="footer-office">
          <h2>Placement office</h2>
          <p>Check the portal for current announcements, interview schedules, and application updates.</p>
          {isManager ? <><Link to="/admin">Office dashboard <ArrowUpRight size={14}/></Link><Link to="/admin/announcements">Manage announcements</Link></> : !user && <Link to="/login?role=MANAGER">Staff sign in <ArrowUpRight size={14}/></Link>}
        </div>
      </div>
      <div className="site-footer-bottom"><span>&copy; {new Date().getFullYear()} College Training &amp; Placement Management</span><span>Placement information and applications in one place.</span></div>
    </footer>
  </div>
}

export function Protected({ manager = false, role, children }) {
  const { user, isManager } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (manager && !isManager) return <Navigate to="/" replace />
  if (role && user.role !== role) return <Navigate to={isManager ? '/admin' : '/'} replace />
  return children
}

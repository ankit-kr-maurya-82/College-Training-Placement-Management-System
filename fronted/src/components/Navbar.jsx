import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/auth.js'

export default function Navbar() {
  const { user, logout, isManager } = useAuth()
  const { pathname } = useLocation()
  const isAuthPage = pathname === '/login' || pathname === '/register'
  const isCompany = String(user?.role || '').toUpperCase() === 'COMPANY'
  if (isAuthPage && !user) return <header className="topbar auth-topbar">
    <Link className="auth-back-home" to="/"><span aria-hidden="true">←</span><span className="auth-back-label">Back to home</span></Link>
    <div className={`auth-top-actions${pathname === '/register' ? ' is-register' : ''}`} aria-label="Account access">
      <Link className={pathname === '/login' ? 'current' : ''} aria-current={pathname === '/login' ? 'page' : undefined} to="/login">Log in</Link>
      <Link className={pathname === '/register' ? 'current' : ''} aria-current={pathname === '/register' ? 'page' : undefined} to="/register">Create account</Link>
    </div>
  </header>
  return <header className="topbar">
    <Link className="brand" to="/">Campus<span>Connect</span></Link>
    <nav><Link to="/drives">Drives</Link><Link to="/companies">Companies</Link>{user?.role === 'STUDENT' && <><Link to="/recommendations">For you</Link><Link to="/applications">My applications</Link><Link to="/interviews">My interviews</Link><Link to="/profile">My profile</Link></>}{isManager && <Link to="/admin">Admin</Link>}{isCompany && <Link to="/company">Company portal</Link>}</nav>
    <div className="account">{user ? <><span>{user.name || user.email}</span><button className="button ghost" onClick={logout}>Log out</button></> : <><Link to="/login">Log in</Link><Link className="button small" to="/register">Create account</Link></>}</div>
  </header>
}

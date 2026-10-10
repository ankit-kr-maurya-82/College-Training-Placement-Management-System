import { Link } from 'react-router-dom'
import { useAuth } from '../context/auth.js'

export default function Navbar() {
  const { user, logout, isManager } = useAuth()
  const isCompany = String(user?.role || '').toUpperCase() === 'COMPANY'
  return <header className="topbar">
    <Link className="brand" to="/">Campus<span>Connect</span></Link>
    <nav><Link to="/drives">Drives</Link><Link to="/companies">Companies</Link>{user?.role === 'STUDENT' && <Link to="/applications">My applications</Link>}{isManager && <Link to="/admin">Admin</Link>}{isCompany && <Link to="/company">Company portal</Link>}</nav>
    <div className="account">{user ? <><span>{user.name || user.email}</span><button className="button ghost" onClick={logout}>Log out</button></> : <><Link to="/login">Log in</Link><Link className="button small" to="/register">Create account</Link></>}</div>
  </header>
}

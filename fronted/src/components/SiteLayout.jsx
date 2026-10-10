import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/auth.js'
import Navbar from './Navbar.jsx'

export function Shell({ children }) {
  return <div className="app-shell">
    <Navbar/><main>{children}</main><footer>College Placement System <span>•</span> Opportunities for your next step</footer>
  </div>
}

export function Protected({ manager = false, role, children }) {
  const { user, isManager } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (manager && !isManager) return <Navigate to="/" replace />
  if (role && user.role !== role) return <Navigate to={isManager ? '/admin' : '/'} replace />
  return children
}

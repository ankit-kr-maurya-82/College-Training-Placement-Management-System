import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/auth.context.jsx'
import AppRoutes from './routes/AppRoutes.jsx'
import './App.css'
import './Auth.css'
import './DarkTheme.css'
import './Redesign.css'
import './Typography.css'
import './RealUI.css'
import './LightTheme.css'

export default function App() {
  return <BrowserRouter>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </BrowserRouter>
}

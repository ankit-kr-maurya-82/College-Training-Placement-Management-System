import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/auth.context.jsx'
import AppRoutes from './routes/AppRoutes.jsx'
import './App.css'

export default function App() {
  return <BrowserRouter>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </BrowserRouter>
}

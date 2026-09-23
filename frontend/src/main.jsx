import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/globals.css'
import './styles/documents.css'
import App from './App.jsx'
// IMPORTA EL PROVIDER AQUÍ
import { AuthProvider } from './context/AuthContext' 

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* 👉 ENVUELVE LA APP CON EL PROVIDER */}
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
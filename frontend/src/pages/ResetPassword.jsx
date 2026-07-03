import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { resetPasswordRequest } from '../api/auth'
import { toast } from '../components/Toast'

export default function ResetPassword() {
  const { token } = useParams()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (password.length < 8) {
      toast('La contraseña debe tener al menos 8 caracteres', 'warn')
      return
    }

    if (password !== confirmPassword) {
      toast('Las contraseñas no coinciden', 'warn')
      return
    }

    try {
      setLoading(true)
      await resetPasswordRequest(token, password)
      toast('Contraseña actualizada correctamente', 'ok')
      setTimeout(() => navigate('/login'), 2000)
    } catch (error) {
      toast(error.response?.data?.message || 'Token inválido o expirado', 'err')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--red-k)', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="card" style={{ width: '100%', maxWidth: 400, padding: '2.5rem' }}>
         <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: 900 }}>Nueva <em style={{ color: 'var(--red)', fontStyle: 'italic', fontWeight: 400 }}>Contraseña</em></h2>
            <p style={{ fontSize: '.85rem', color: 'var(--ash)', marginTop: '.5rem' }}>Ingresa tu nueva clave de acceso.</p>
         </div>

         <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: '1rem' }}>
               <label className="lbl">Nueva Contraseña</label>
               <input 
                  type="password" 
                  className="finput" 
                  placeholder="Min. 8 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
               />
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
               <label className="lbl">Confirmar Contraseña</label>
               <input 
                  type="password" 
                  className="finput" 
                  placeholder="Repite la contraseña" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required 
               />
            </div>
            
            <button className="btn btn-red" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
               {loading ? 'Procesando...' : 'Cambiar contraseña'}
            </button>
         </form>
      </div>
    </div>
  )
}
